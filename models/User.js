const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  Name: { type: String, required: true, trim: true },
  Phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  Password: { type: String, required: false, trim: true },
  doorNoAndStreetName: { type: String, required: true, trim: true },
  Area: { type: String, required: true, trim: true },
  Place: { type: String, required: true, trim: true },
  loggedIn: { type: Boolean, default: false }, // <-- ADD THIS LINE
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
