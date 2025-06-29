const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Use a specific origin in production
    methods: ["GET", "POST", "PATCH"]
  }
});

// ✅ Middleware: Attach io to every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
require('./config/db')();

// ✅ Public File Access
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Routes
app.use('/grocery', require('./routes/grocery'));
app.use('/food', require('./routes/food'));
app.use('/vegetables-and-fruits', require('./routes/vegetablesAndFruits'));
app.use('/user', require('./routes/user'));
app.use('/toyboxz', require('./routes/toyboxz'));
app.use('/otp', require('./routes/otp'));
app.use('/login', require('./routes/loginOtp'));
app.use('/orders', require('./routes/order')); // Main order route
app.use('/delivery-partner/auth', require('./routes/deliveryLogin'));
app.use('/delivery-partner', require('./routes/deliveryPartnerUser'));
app.use('/delivery-partners-images', require('./routes/deliveryPartnersImages'));
app.use('/delivery-status', require('./routes/deliveryPartnerDutyStatus'));
app.use('/admin-user/auth', require('./routes/adminLogin'));
app.use('/admin-user', require('./routes/adminUser'));
app.use("/delivery-partner-stats", require("./routes/deliveryPartnerStats"))
app.use("/withdrawal", require("./routes/withdrawal"))

// ✅ Basic health check route
app.get('/', (req, res) => res.send('Hello, Backend is running!'));

// ✅ Socket.IO Connection Logic
io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // Allow captains to join a room named after their email
  socket.on('join', (email) => {
    if (email) {
      socket.join(email);
      console.log(`📡 Socket ${socket.id} joined room: ${email}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
