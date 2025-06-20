const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  quantityType: {
    type: String,
    required: true
  },
  quantityOne: {
    type: String,
    required: true
  },
  quantityTwo: {
    type: String,
    required: false  // optional
  },
  count: {
    type: Number,
    required: true
  }
});

const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  street: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  },
  defaultAddress: {
    type: String,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  products: {
    type: [productSchema],
    required: true
  },
  address: {
    type: addressSchema,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status:{
    type: String,
    required: false
  }
});

module.exports = mongoose.model('Order', orderSchema);
