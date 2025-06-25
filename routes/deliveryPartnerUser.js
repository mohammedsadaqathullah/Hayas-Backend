const express = require('express');
const router = express.Router();
const DeliveryPartnerUser = require('../models/DeliveryPartnerUser');
const DeliveryPartnersImages = require('../models/DeliveryPartnersImages');
const { sendEmailOTP, verifyOTP } = require('../models/Otp');

// POST - Register or Update Delivery Partner
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

    // 🔍 Check for required fields
    if (!name || !email || !phone || !address || !pincode) {
      return res.status(400).json({ error: 'All required fields must be provided.' });
    }

    // ✅ Check if images exist for this email before proceeding
    const imageDoc = await DeliveryPartnersImages.findOne({ email });
    if (!imageDoc) {
      return res.status(400).json({
        error: 'Please upload your documents before registering.',
      });
    }

    // 🧾 Map of user field names to image keys
    const imageFieldMap = {
      profileImage: 'profile',
      dlFront: 'driving_license_front',
      dlBack: 'driving_license_back',
      aadhaarFront: 'aadhaar_front',
      aadhaarBack: 'aadhaar_back',
    };

    // 🔍 Find missing images
    const missingTypes = Object.entries(imageFieldMap)
      .filter(([_, imageKey]) => !imageDoc.images?.[imageKey]?.url)
      .map(([userField, _]) => userField);

    if (missingTypes.length > 0) {
      return res.status(400).json({
        error: `Missing document(s): ${missingTypes.join(', ')}. Please upload all required documents before registering.`,
      });
    }

    // 🧠 Check if user already exists
    const existingUser = await DeliveryPartnerUser.findOne({ email });

    // 📥 Register or update the user
    const updatedUser = await DeliveryPartnerUser.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          parentName,
          phone,
          address,
          pincode,
          profileImage,
          dlFront,
          dlBack,
          aadhaarFront,
          aadhaarBack,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const message = existingUser
      ? 'User updated successfully'
      : 'User registered successfully';

    res.status(201).json({ message, user: updatedUser });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
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

// PATCH /delivery-partner/status
// Body expects: { email: "...", status: "Approved" | "Rejected" }
router.patch('/status', async (req, res) => {
  const { email, status } = req.body;

  if (!email || (status !== 'Approved' && status !== 'Rejected')) {
    return res.status(400).json({
      error: 'Invalid request: provide email and status as "Approved" or "Rejected"',
    });
  }

  try {
    const user = await DeliveryPartnerUser.findOneAndUpdate(
      { email },
      { $set: { status } },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ error: 'Delivery partner not found' });
    }

    res.status(200).json({ message: `Status updated to ${status}`, user });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET - Fetch a delivery partner by email (email in body)
router.post('/by-email', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const user = await DeliveryPartnerUser.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'Delivery partner not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('Fetch by email error:', err);
    res.status(500).json({ error: 'Failed to fetch user by email' });
  }
});



module.exports = router;
