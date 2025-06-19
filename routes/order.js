const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// POST /orders — Place a new order
router.post('/', async (req, res) => {
  try {
    const { products, address, userEmail } = req.body;

    if (!products?.length || !address || !userEmail) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const newOrder = new Order({ products, address, userEmail });
    await newOrder.save();

    res.status(201).json({ message: 'Order placed successfully!' });
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/orders — Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/orders/:email — Get orders by user email
router.get('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 });

    if (!orders.length) {
      return res.status(404).json({ message: 'No orders found for this email.' });
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders by email:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
