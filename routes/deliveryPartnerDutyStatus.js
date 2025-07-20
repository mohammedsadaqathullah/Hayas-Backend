const express = require('express');
const router = express.Router();
const DeliveryPartnerDutyStatus = require('../models/DeliveryPartnerDutyStatus');
const Order = require('../models/Order');
const cron = require('node-cron');

function formatDate(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// POST /duty-status/update
router.post('/update', async (req, res) => {
    try {
        const { email, duty } = req.body;

        if (!email || typeof duty !== 'boolean') {
            return res.status(400).json({ error: 'Email and duty(boolean) are required.' });
        }

        const now = new Date();
        const today = formatDate(now);

        let record = await DeliveryPartnerDutyStatus.findOne({ email });

        if (!record) {
            const session = duty ? { dutyTrue: now } : { dutyFalse: now };
            record = new DeliveryPartnerDutyStatus({
                email,
                statusLog: [
                    {
                        date: today,
                        sessions: [session]
                    }
                ]
            });
        } else {
            let dateLog = record.statusLog.find(log => log.date === today);

            if (!dateLog) {
                record.statusLog.push({
                    date: today,
                    sessions: [{ dutyTrue: null, dutyFalse: null, workingHours: 0 }]
                });
                dateLog = record.statusLog.find(log => log.date === today);
            }

            const sessions = dateLog.sessions;
            const lastSession = sessions[sessions.length - 1];

            if (duty) {
                if (lastSession && lastSession.dutyTrue === null) {
                    lastSession.dutyTrue = now;
                } else {
                    sessions.push({ dutyTrue: now });
                }
            } else {
                const hasConfirmedOrder = await Order.findOne({
                    status: 'CONFIRMED',
                    statusHistory: {
                        $elemMatch: {
                            email: email,
                            status: 'CONFIRMED'
                        }
                    }
                });

                if (hasConfirmedOrder) {
                    return res.status(403).json({
                        message: 'You have a confirmed order. Complete it before going off duty.'
                    });
                }

                if (lastSession && lastSession.dutyTrue && !lastSession.dutyFalse) {
                    const loginTime = new Date(lastSession.dutyTrue);
                    const logoutTime = now;

                    const loginDate = formatDate(loginTime);
                    const logoutDate = formatDate(logoutTime);

                    if (loginDate === logoutDate) {
                        lastSession.dutyFalse = logoutTime;
                        const hours = (logoutTime - loginTime) / (1000 * 60 * 60);
                        lastSession.workingHours = parseFloat(hours.toFixed(2));
                    } else {
                        const endOfLoginDay = new Date(loginDate + 'T23:59:59.999Z');
                        const startOfLogoutDay = new Date(logoutDate + 'T00:00:00.000Z');

                        lastSession.dutyFalse = endOfLoginDay;
                        const hours1 = (endOfLoginDay - loginTime) / (1000 * 60 * 60);
                        lastSession.workingHours = parseFloat(hours1.toFixed(2));

                        let nextDateLog = record.statusLog.find(log => log.date === logoutDate);
                        if (!nextDateLog) {
                            nextDateLog = {
                                date: logoutDate,
                                sessions: []
                            };
                            record.statusLog.push(nextDateLog);
                        }

                        const hours2 = (logoutTime - startOfLogoutDay) / (1000 * 60 * 60);
                        nextDateLog.sessions.push({
                            dutyTrue: startOfLogoutDay,
                            dutyFalse: logoutTime,
                            workingHours: parseFloat(hours2.toFixed(2))
                        });
                    }
                } else {
                    sessions.push({ dutyFalse: now });
                }
            }
        }

        await record.save();
        res.status(200).json({ message: 'Duty status updated successfully', data: record });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /duty-status/:email
router.get('/:email', async (req, res) => {
    try {
        const email = req.params.email;

        const record = await DeliveryPartnerDutyStatus.findOne({ email });

        if (!record) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ data: record });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /duty-status/heartbeat
router.post('/heartbeat', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const now = new Date();
        const today = formatDate(now);

        const record = await DeliveryPartnerDutyStatus.findOne({ email });

        if (!record) {
            return res.status(404).json({ error: 'Duty status record not found.' });
        }

        const dateLog = record.statusLog.find(log => log.date === today);

        if (!dateLog) {
            return res.status(404).json({ error: 'No duty session found for today.' });
        }

        const lastSession = dateLog.sessions[dateLog.sessions.length - 1];

        if (lastSession && lastSession.dutyTrue && !lastSession.dutyFalse) {
            lastSession.dutyTrue = now;
            await record.save();
            return res.status(200).json({ message: 'Heartbeat updated successfully.', data: record });
        } else {
            return res.status(400).json({ error: 'No active duty session to update.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// CRON Job to auto off-duty after 20 minutes of no heartbeat
cron.schedule('*/5 * * * *', async () => {
    const now = new Date();

    try {
        const records = await DeliveryPartnerDutyStatus.find({});

        records.forEach(async (record) => {
            record.statusLog.forEach(log => {
                log.sessions.forEach(async session => {
                    if (session.dutyTrue && !session.dutyFalse) {
                        const diffMins = (now - new Date(session.dutyTrue)) / (1000 * 60);
                        if (diffMins > 20) {
                            session.dutyFalse = now;
                            const hours = (now - new Date(session.dutyTrue)) / (1000 * 60 * 60);
                            session.workingHours = parseFloat(hours.toFixed(2));
                            await record.save();
                            console.log(`Auto off-duty for ${record.email} after ${diffMins} mins`);
                        }
                    }
                });
            });
        });
    } catch (err) {
        console.error('Error in auto off-duty cron:', err);
    }
});

module.exports = router;
