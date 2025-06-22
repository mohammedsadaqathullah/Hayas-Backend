const express = require('express');
const mongoose = require('mongoose');
const http = require('http'); // ✅ FIXED: import http
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app); // ✅ use for socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // ✅ update this or use "*" for development
    methods: ["GET", "POST", "PATCH"]
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Socket.IO integration into requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// MongoDB connection
require('./config/db')();

// Routes
app.use('/grocery', require('./routes/grocery'));
app.use('/food', require('./routes/food'));
app.use('/vegetables-and-fruits', require('./routes/vegetablesAndFruits'));
app.use('/user', require('./routes/user'));
app.use('/toyboxz', require('./routes/toyboxz'));
app.use('/otp', require('./routes/otp'));
app.use('/login', require('./routes/loginOtp'));
app.use('/orders', require('./routes/order')); // ✅ this should match with the route you wrote
app.use('/delivery-partner/auth', require('./routes/deliveryLogin'));
app.use('/delivery-partner', require('./routes/deliveryPartnerUser'));
app.use('/delivery-partners-images', require('./routes/deliveryPartnersImages'))
app.use('/admin-user/auth',require ('./routes/adminLogin'));
app.use('/admin-user',require('./routes/adminUser'));
// Basic route
app.get('/', (req, res) => res.send('Hello, Backend is running!'));

// Socket connection
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
