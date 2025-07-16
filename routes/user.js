const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { encryptData, decryptData } = require('../utils/encryptDecrypt');


router.post('/', async (req, res) => {
    try {
        const { name, phone, email, password, doorNoAndStreetName, area, place } = req.body;

        // Check if email already exists
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create new address
        const newUser = new User({
            name,
            phone,
            email: email.toLowerCase(),
            password,
            doorNoAndStreetName,
            area,
            place,
        });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (err) {
        res.status(500).json({ error: 'Error saving User', details: err.message });
    }
});

router.get('/by-email/:email', async (req, res) => {
  try {
    //     const encrypted = decodeURIComponent(req.params.email);
    // const decryptedEmail = decryptData(encrypted);
    const email = req.params.email

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No User found' });
    }
    const userObject = user.toObject();
    // const encryptedUser = encryptData(userObject);

    res.status(200).json({ userObject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching User', details: err.message });
  }
});
router.get('/by-phone/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: 'No User found' });
    }

    const userObject = user.toObject();
    res.status(200).json({ userObject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching User by phone', details: err.message });
  }
});

router.put('/:email', async (req, res) => {
    try {
        const updated = await User.findOneAndUpdate(
            { email: req.params.email.toLowerCase() },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'User not found' });
        res.status(200).json({ message: 'Updated successfully', user: updated });
    } catch (err) {
        res.status(400).json({ error: 'Error updating', details: err });
    }
});

router.delete('/:email', async (req, res) => {
    try {
        const deleted = await User.findOneAndDelete({ email: req.params.email.toLowerCase() });
        if (!deleted) return res.status(404).json({ error: 'User not found' });
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting', details: err });
    }
});
// GET /user — List all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users', details: err.message });
  }
});

module.exports = router;
