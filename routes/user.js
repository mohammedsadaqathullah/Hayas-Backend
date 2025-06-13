const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/', async (req, res) => {
    try {
        const { Name, Phone, email, Password, doorNoAndStreetName, Area, Place } = req.body;

        // Check if email already exists
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create new address
        const newUser = new User({
            Name,
            Phone,
            email: email.toLowerCase(),
            Password,
            doorNoAndStreetName,
            Area,
            Place,
            loggedIn: true
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

// Logout user by setting loggedIn to false
router.post('/logout', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { loggedIn: false }
        );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User logged out successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Error logging out user', details: err.message });
  }
});


module.exports = router;
