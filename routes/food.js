const express = require('express');
const router = express.Router();
const Food = require('../models/Food');

router.post('/', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newFood = new Food({ imageURL, title, description, quantityOne, quantityTwo });
        await newFood.save();
        res.status(201).json({ message: 'Food created successfully', food: newFood });
    } catch (err) {
        res.status(400).json({ error: 'Error creating food', details: err });
    }
});

router.get('/', async (req, res) => {
    try {
        const food = await Food.find();
        res.status(200).json(food);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching food', details: err });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        if (!food) return res.status(404).json({ error: 'Food not found' });
        res.status(200).json(food);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching food', details: err });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedFood = await Food.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
            { new: true }
        );
        if (!updatedFood) return res.status(404).json({ error: 'Food not found' });
        res.status(200).json({ message: 'Food updated successfully', food: updatedFood });
    } catch (err) {
        res.status(400).json({ error: 'Error updating food', details: err });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deletedFood = await Food.findByIdAndDelete(req.params.id);
        if (!deletedFood) return res.status(404).json({ error: 'Food not found' });
        res.status(200).json({ message: 'Food deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting food', details: err });
    }
});

module.exports = router;
