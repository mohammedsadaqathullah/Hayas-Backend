const express = require('express');
const router = express.Router();
const ToyBoxz = require('../models/ToyBoxz');  // Make sure this path matches your project structure

// Create a new toy
router.post('/', async (req, res) => {
    try {
        const { imageURL, title, description, sizeSmall, sizeLarge } = req.body;
        const newToy = new ToyBoxz({ imageURL, title, description, sizeSmall, sizeLarge });
        await newToy.save();
        res.status(201).json({ message: 'Toy created successfully', toy: newToy });
    } catch (err) {
        res.status(400).json({ error: 'Error creating toy', details: err });
    }
});

// Get all toys
router.get('/', async (req, res) => {
    try {
        const toys = await ToyBoxz.find();
        res.status(200).json(toys);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching toys', details: err });
    }
});

// Get a specific toy by ID
router.get('/:id', async (req, res) => {
    try {
        const toy = await ToyBoxz.findById(req.params.id);
        if (!toy) return res.status(404).json({ error: 'Toy not found' });
        res.status(200).json(toy);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching toy', details: err });
    }
});

// Update a toy by ID
router.put('/:id', async (req, res) => {
    try {
        const { imageURL, title, description, sizeSmall, sizeLarge } = req.body;
        const updatedToy = await ToyBoxz.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, sizeSmall, sizeLarge },
            { new: true }
        );
        if (!updatedToy) return res.status(404).json({ error: 'Toy not found' });
        res.status(200).json({ message: 'Toy updated successfully', toy: updatedToy });
    } catch (err) {
        res.status(400).json({ error: 'Error updating toy', details: err });
    }
});

// Delete a toy by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedToy = await ToyBoxz.findByIdAndDelete(req.params.id);
        if (!deletedToy) return res.status(404).json({ error: 'Toy not found' });
        res.status(200).json({ message: 'Toy deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting toy', details: err });
    }
});

module.exports = router;
