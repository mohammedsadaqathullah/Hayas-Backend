const express = require('express');
const router = express.Router();
const Grocery = require('../models/Grocery');

router.post('/', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newGrocery = new Grocery({ imageURL, title, description, quantityOne, quantityTwo });
        await newGrocery.save();
        res.status(201).json({ message: 'Product created successfully', grocery: newGrocery });
    } catch (err) {
        res.status(400).json({ error: 'Error creating product', details: err });
    }
});

router.get('/', async (req, res) => {
    try {
        const grocery = await Grocery.find();
        res.status(200).json(grocery);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching products', details: err });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const grocery = await Grocery.findById(req.params.id);
        if (!grocery) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json(grocery);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching product', details: err });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedGrocery = await Grocery.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
            { new: true }
        );
        if (!updatedGrocery) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product updated successfully', grocery: updatedGrocery });
    } catch (err) {
        res.status(400).json({ error: 'Error updating product', details: err });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deletedGrocery = await Grocery.findByIdAndDelete(req.params.id);
        if (!deletedGrocery) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting product', details: err });
    }
});

module.exports = router;
