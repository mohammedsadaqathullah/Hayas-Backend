const express = require('express');
const router = express.Router();
const { sendEmailOTP, verifyOTP } = require('../models/Otp');

// Send OTP route
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  try {
    await sendEmailOTP(email);
    res.status(200).json({ success: true, message: 'OTP sent!' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// Verify OTP route
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const isValid = verifyOTP(email, otp);
  if (isValid) {
    res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
});

module.exports = router;
