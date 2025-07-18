const mongoose = require('mongoose');

const UploadedImageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [
    {
      url: { type: String, required: true },
      filename: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('UploadedImage', UploadedImageSchema);
