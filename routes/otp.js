const express = require('express');
const router = express.Router();
const { sendEmailOTP, verifyOTP } = require('../models/Otp');
const User = require('../models/User');

// Send OTP route
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Invalid or missing email' });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    await sendEmailOTP(email);
    res.status(200).json({ success: true, message: 'OTP sent!' });
  } catch (error) {
    console.error('Error sending OTP:', error.message);
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
