const express = require('express');
const router = express.Router();
const User = require('../models/User');
const validationKey = require('../validationkey')
const CryptoJS = require("crypto-js");


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
        const user = await User.findOne({ email: req.params.email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'No User found' });
        }
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching User', details: err });
    }
});

router.get('/by-email-verify/:email', async (req, res) => {
  try {
    const encryptedEmail = decodeURIComponent(req.params.email);
    console.log("🔐 Encrypted Email (decoded from URL):", encryptedEmail);

    const bytes = CryptoJS.AES.decrypt(encryptedEmail, validationKey);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

    console.log("📧 Decrypted Email:", decryptedText);

    if (!decryptedText) {
      return res.status(400).json({ error: 'Invalid encrypted email' });
    }

    const user = await User.findOne({ email: decryptedText.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No User found' });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("❌ Decryption error:", err);
    res.status(500).json({ error: 'Error fetching User', details: err.message });
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


module.exports = router;
