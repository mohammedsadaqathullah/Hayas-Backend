// models/DeliveryPartnersImages.js
const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  images: {
    profile: {
      url: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    driving_license_front: {
      url: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    driving_license_back: {
      url: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    aadhaar_front: {
      url: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    aadhaar_back: {
      url: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
  },
});

module.exports = mongoose.model('DeliveryPartnersImages', deliveryPartnerSchema);
