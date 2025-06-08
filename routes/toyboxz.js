const express = require('express');
const router = express.Router();
const Toyboxz = require('../models/ToyBoxz');

router.post('/', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newToyboxz = new Toyboxz({ imageURL, title, description, quantityOne, quantityTwo });
        await newToyboxz.save();
        res.status(201).json({ message: 'Product created successfully', toyboxz: newToyboxz });
    } catch (err) {
        res.status(400).json({ error: 'Error creating product', details: err });
    }
});

router.get('/', async (req, res) => {
    try {
        const toyboxz = await Toyboxz.find();
        res.status(200).json(toyboxz);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching products', details: err });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const toyboxz = await Toyboxz.findById(req.params.id);
        if (!toyboxz) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json(toyboxz);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching product', details: err });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedToyboxz = await Toyboxz.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
            { new: true }
        );
        if (!updatedToyboxz) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product updated successfully', toyboxz: updatedToyboxz });
    } catch (err) {
        res.status(400).json({ error: 'Error updating product', details: err });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deletedToyboxz = await Toyboxz.findByIdAndDelete(req.params.id);
        if (!deletedToyboxz) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting product', details: err });
    }
});

module.exports = router;
