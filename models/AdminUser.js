const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  number: {
    type: String,
    required: true,
    match: /^\d{10}$/, // validates 10-digit phone number
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('AdminUser', AdminUserSchema);
