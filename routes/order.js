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

    const newOrder = new Order({
      products,
      address,
      userEmail,
      status: 'PENDING' // default status
    });

    await newOrder.save();

    // Emit socket event to notify admin dashboard
    req.io.emit('new-order', {
      message: 'New order received',
      order: newOrder
    });

    res.status(201).json({ message: 'Order placed successfully!', order: newOrder });
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /orders — Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /orders/:email — Get orders by user email
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

// PATCH /orders/:id/status — Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Emit status update to connected clients
    req.io.emit('order-status-updated', {
      message: 'Order status updated',
      order: updatedOrder
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
