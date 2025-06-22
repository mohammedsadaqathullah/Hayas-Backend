const express = require('express');
const router = express.Router();
const DeliveryPartnerUser = require('../models/DeliveryPartnerUser');
const { sendEmailOTP, verifyOTP } = require('../models/Otp');

// POST - Register a new Delivery Partner
router.post('/', async (req, res) => {
  try {
    const {
      name,
      parentName,
      email,
      phone,
      address,
      pincode,
      profileImage,
      dlFront,
      dlBack,
      aadhaarFront,
      aadhaarBack,
    } = req.body;

    // Basic server-side validation
    if (!otpVerified) return res.status(400).json({ error: 'OTP not verified' });

    const user = new DeliveryPartnerUser({
      name,
      parentName,
      email,
      phone,
      address,
      pincode,
      profileImage,
      dlFront,
      dlBack,
      aadhaarFront,
      aadhaarBack,
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error',err });
  }
});

// POST /delivery-partners/send-otp
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

// POST /api/delivery-partners/verify-otp
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

// GET - Fetch all registered delivery partners
router.get('/', async (req, res) => {
  try {
    const users = await DeliveryPartnerUser.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
// PATCH - Update delivery partner by email
router.patch('/:email', async (req, res) => {
  const { email } = req.params;
  const updates = req.body;

  try {
    const user = await DeliveryPartnerUser.findOneAndUpdate(
      { email },
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Delivery partner not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});


module.exports = router;
