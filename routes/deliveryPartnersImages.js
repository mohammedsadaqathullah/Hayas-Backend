// routes/deliveryPartnerRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DeliveryPartnersImages = require('../models/DeliveryPartnersImages');

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
    let user = await DeliveryPartnersImages.findOne({ email });
    if (!user) {
      user = new DeliveryPartnersImages({ email });
    }

    files.forEach((file, index) => {
      const type = parsedTypes[index];
      if (!allowedTypes.includes(type)) return;

      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      user.images[type] = {
        url: imageUrl,
        uploadedAt: new Date(),
      };
    });

    await user.save();

    res.status(201).json({
      message: 'Images uploaded successfully',
      email,
      images: user.images,
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

router.patch('/:email/:type', upload.single('image'), async (req, res) => {
  const { email, type } = req.params;
  const file = req.file;

  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid image type' });
  }

  if (!file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    const user = await DeliveryPartnersImages.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 🧹 Delete old file if exists
    const oldImageUrl = user.images[type]?.url;
    if (oldImageUrl) {
      const oldFileName = oldImageUrl.split('/uploads/')[1];
      const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath); // Deletes the old file
      }
    }

    const newImageUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    user.images[type] = {
      url: newImageUrl,
      uploadedAt: new Date(),
    };

    await user.save();

    res.status(200).json({
      message: `Image '${type}' updated successfully`,
      updatedType: type,
      image: user.images[type],
    });
  } catch (error) {
    console.error('Patch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
