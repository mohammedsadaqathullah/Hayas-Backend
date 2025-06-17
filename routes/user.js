const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CryptoJS = require("../node_modules/crypto-js");


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
          const bytes = await CryptoJS.AES.decrypt(encryptedEmail, 'b14ca5hA1YA133bbcS00123456789012');
  const decryptedText = await bytes.toString(CryptoJS.enc.Utf8);
        const user = await User.findOne({ email: req.params.email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'No User found' });
        }
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching User', details: err });
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
