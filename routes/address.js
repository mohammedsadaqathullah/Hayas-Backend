const express = require('express');
const router = express.Router();
const Address = require('../models/Address');

router.post('/', async (req, res) => {
    try {
        const { Name, Phone, email, doorNoAndStreetName, Area, Place } = req.body;
        const updatedAddress = await Address.findOneAndUpdate(
            { email: email.toLowerCase() },
            { Name, Phone, email: email.toLowerCase(), doorNoAndStreetName, Area, Place },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(200).json({ message: 'Address saved successfully', address: updatedAddress });
    } catch (err) {
        res.status(400).json({ error: 'Error saving address', details: err });
    }
});

router.get('/by-email/:email', async (req, res) => {
    try {
        const address = await Address.findOne({ email: req.params.email.toLowerCase() });
        if (!address) return res.status(404).json({ error: 'No address found' });
        res.status(200).json(address);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching address', details: err });
    }
});

router.put('/:email', async (req, res) => {
    try {
        const updated = await Address.findOneAndUpdate(
            { email: req.params.email.toLowerCase() },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Address not found' });
        res.status(200).json({ message: 'Updated successfully', address: updated });
    } catch (err) {
        res.status(400).json({ error: 'Error updating', details: err });
    }
});

router.delete('/:email', async (req, res) => {
    try {
        const deleted = await Address.findOneAndDelete({ email: req.params.email.toLowerCase() });
        if (!deleted) return res.status(404).json({ error: 'Address not found' });
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting', details: err });
    }
});

module.exports = router;
