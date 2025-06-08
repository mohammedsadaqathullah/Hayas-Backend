const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
require('./config/db')();

// Routes
app.use('/grocery', require('./routes/grocery'));
app.use('/food', require('./routes/food'));
app.use('/vegetables-and-fruits', require('./routes/vegetablesAndFruits'));
app.use('/address', require('./routes/address'));
app.use('/toyboxz', require('./models/ToyBoxz'));

// Basic Route
app.get('/', (req, res) => res.send('Hello, Backend is running!'));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
