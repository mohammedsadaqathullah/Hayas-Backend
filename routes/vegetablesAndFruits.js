const express = require('express');
const router = express.Router();
const VegetablesAndFruits = require('../models/VegetablesAndFruits');

router.post('/', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newItem = new VegetablesAndFruits({ imageURL, title, description, quantityOne, quantityTwo });
        await newItem.save();
        res.status(201).json({ message: 'Item created successfully', item: newItem });
    } catch (err) {
        res.status(400).json({ error: 'Error creating item', details: err });
    }
});

router.get('/', async (req, res) => {
    try {
        const items = await VegetablesAndFruits.find();
        res.status(200).json(items);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching items', details: err });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const item = await VegetablesAndFruits.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching item', details: err });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedItem = await VegetablesAndFruits.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
            { new: true }
        );
        if (!updatedItem) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item updated successfully', item: updatedItem });
    } catch (err) {
        res.status(400).json({ error: 'Error updating item', details: err });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deletedItem = await VegetablesAndFruits.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting item', details: err });
    }
});

module.exports = router;
