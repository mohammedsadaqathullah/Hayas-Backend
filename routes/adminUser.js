const express = require('express');
const router = express.Router();
const AdminUser = require('../models/AdminUser');
const { sendEmailOTP, verifyOTP } = require('../models/Otp');

// POST /api/admin-users/send-otp
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    await sendEmailOTP(email);
    res.status(200).json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/admin-users/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const valid = verifyOTP(email, otp);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  res.status(200).json({ message: 'OTP verified successfully' });
});

// POST /api/admin-users/ — register new user, only if OTP verified
router.post('/', async (req, res) => {
  const { name, email, number, otp } = req.body;

  if (!name || !email || !number || !otp) {
    return res.status(400).json({ error: 'Name, email, number, and OTP are required' });
  }

  const isVerified = verifyOTP(email, otp);
  if (!isVerified) {
    return res.status(400).json({ error: 'OTP not verified or expired' });
  }

  try {
    const existing = await AdminUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = new AdminUser({ name, email, number });
    await user.save();
    res.status(201).json({ message: 'Admin user registered', user });
  } catch (err) {
    console.error('AdminUser registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin-users/ — get all admin users
router.get('/', async (req, res) => {
  try {
    const users = await AdminUser.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error('Fetch AdminUsers error:', err);
    res.status(500).json({ error: 'Could not fetch users' });
  }
});

module.exports = router;
