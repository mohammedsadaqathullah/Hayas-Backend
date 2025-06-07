const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  Name: {
    type: String,
    required: true,
    trim: true,
  },
  Phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true, // 👈 Ensures one address per email
  },
  doorNoAndStreetName: {
    type: String,
    required: true,
    trim: true,
  },
  Area: {
    type: String,
    required: true,
    trim: true,
  },
  Place: {
    type: String,
    required: true,
    trim: true,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Address', AddressSchema);
