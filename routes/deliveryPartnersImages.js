// routes/deliveryPartnerRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DeliveryPartnersImages = require('../models/DeliveryPartnersImages');
const DeliveryPartnerUser = require('../models/DeliveryPartnerUser');

const router = express.Router();
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Allowed types
const allowedTypes = [
  'profile',
  'driving_license_front',
  'driving_license_back',
  'aadhaar_front',
  'aadhaar_back',
];

/**
 * POST /api/images/upload-multiple
 */
router.post('/upload-multiple', upload.array('images'), async (req, res) => {
  const { email, types } = req.body;
  const files = req.files;

  if (!email || !types || !files) {
    return res.status(400).json({ error: 'Email, types, and images are required' });
  }

  let parsedTypes;
  try {
    parsedTypes = Array.isArray(types) ? types : JSON.parse(types);
  } catch {
    return res.status(400).json({ error: 'Invalid types format. Must be a JSON array.' });
  }

  if (parsedTypes.length !== files.length) {
    return res.status(400).json({ error: 'Types and images count must match' });
  }

  try {
    let imageDoc = await DeliveryPartnersImages.findOne({ email });
    if (!imageDoc) {
      imageDoc = new DeliveryPartnersImages({ email });
    }

    const updatedFields = {};

    for (let i = 0; i < files.length; i++) {
      const type = parsedTypes[i];
      const file = files[i];

      if (!allowedTypes.includes(type)) continue;

      const newUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      const oldImage = imageDoc.images[type];

      const wasExisting = oldImage && oldImage.url;

      // If there was a previous image, delete it from disk
      if (wasExisting) {
        const oldPath = path.join(__dirname, '..', oldImage.url.replace(`${req.protocol}://${req.get('host')}/`, ''));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Save new image to DeliveryPartnersImages
      imageDoc.images[type] = {
        url: newUrl,
        uploadedAt: new Date(),
      };

      // Only sync to DeliveryPartnerUser if we are replacing an existing image
      if (wasExisting) {
        switch (type) {
          case 'profile':
            updatedFields.profileImage = newUrl;
            break;
          case 'driving_license_front':
            updatedFields.dlFront = newUrl;
            break;
          case 'driving_license_back':
            updatedFields.dlBack = newUrl;
            break;
          case 'aadhaar_front':
            updatedFields.aadhaarFront = newUrl;
            break;
          case 'aadhaar_back':
            updatedFields.aadhaarBack = newUrl;
            break;
        }
      }
    }

    await imageDoc.save();

    if (Object.keys(updatedFields).length > 0) {
      await DeliveryPartnerUser.findOneAndUpdate(
        { email },
        { $set: updatedFields },
        { new: true }
      );
    }

    res.status(201).json({
      message: 'Images uploaded successfully',
      email,
      images: imageDoc.images,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/images
 */
router.get('/', async (req, res) => {
  try {
    const users = await DeliveryPartnersImages.find().sort({ email: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

/**
 * GET /api/images/:email
 */
router.get('/:email', async (req, res) => {
  try {
    const user = await DeliveryPartnersImages.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ error: 'No images found for this email' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
