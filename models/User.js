const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: false, trim: true },
  doorNoAndStreetName: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  place: { type: String, required: true, trim: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
