const express = require('express');
const router = express.Router();
const { sendEmailOTP, verifyOTP } = require('../models/Otp');
const DeliveryPartnerUser = require('../models/DeliveryPartnerUser');

// POST /auth/delivery/send-otp
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email is required' });
  }

  try {
    const partner = await DeliveryPartnerUser.findOne({ email: email.toLowerCase() });

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Delivery partner email not found' });
    }

    // ⛔ Block if status is Pending or Rejected
    if (partner.status === 'Pending') {
      return res.status(403).json({
        success: false,
        message: 'Your application is still under review. OTP cannot be sent at this time.',
      });
    }

    if (partner.status === 'Rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your application has been rejected. Contact support for assistance.',
      });
    }

    await sendEmailOTP(email.toLowerCase());
    res.status(200).json({ success: true, message: 'OTP sent to delivery partner email' });
  } catch (err) {
    console.error('Delivery OTP send error:', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP', err });
  }
});

// POST /auth/delivery/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP required' });
  }

  const valid = verifyOTP(email.toLowerCase(), otp);
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  res.status(200).json({ success: true, message: 'Delivery partner OTP verified' });
});

module.exports = router;
