const mongoose = require('mongoose');

const DeliveryPartnerUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  parentName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
    match: /^\d{10}$/, // ensures exactly 10 digits
  },
  address: {
    type: String,
    required: true,
  },
  pincode: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    required: true,
  },
  dlFront: {
    type: String,
    required: true,
  },
  dlBack: {
    type: String,
    required: true,
  },
  aadhaarFront: {
    type: String,
    required: true,
  },
  aadhaarBack: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
  type: String,
  enum: ['Pending', 'Approved', 'Rejected'],
  default: 'Pending',
},

});

module.exports = mongoose.model('DeliveryPartnerUser', DeliveryPartnerUserSchema);
