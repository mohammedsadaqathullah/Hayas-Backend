const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const DeliveryPartnersImages = require('../models/DeliveryPartnersImages');
const DeliveryPartnerUser = require('../models/DeliveryPartnerUser');
const admin = require('firebase-admin');

const router = express.Router();

// Firebase setup
const serviceAccount = require('../firebase/hayas-backend-firebase-adminsdk-fbsvc-ace06e200f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'hayas-backend.appspot.com',
});

const bucket = admin.storage().bucket();

// Multer config (in-memory buffer)
const upload = multer({ storage: multer.memoryStorage() });

// Allowed types
const allowedTypes = [
  'profile',
  'driving_license_front',
  'driving_license_back',
  'aadhaar_front',
  'aadhaar_back',
];

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

      const filename = `${type}-${email}-${Date.now()}`;
      const firebaseFile = bucket.file(filename);

      const metadata = {
        contentType: file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      };

      await firebaseFile.save(file.buffer, { metadata });

      const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${metadata.metadata.firebaseStorageDownloadTokens}`;

      const oldImage = imageDoc.images[type];
      const wasExisting = oldImage && oldImage.url;

      imageDoc.images[type] = {
        url: newUrl,
        uploadedAt: new Date(),
      };

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

    // 🔁 TEMPORARY IMAGE CLEANUP LOGIC AFTER 15 MINUTES
    setTimeout(async () => {
      const userExists = await DeliveryPartnerUser.findOne({ email });
      if (!userExists) {
        // Delete files from Firebase
        const deletePromises = Object.entries(imageDoc.images).map(async ([_, img]) => {
          if (img?.url) {
            const pathMatch = img.url.match(/\/o\/(.*?)\?/);
            if (pathMatch && pathMatch[1]) {
              const decodedPath = decodeURIComponent(pathMatch[1]);
              await bucket.file(decodedPath).delete().catch(console.error);
            }
          }
        });

        await Promise.all(deletePromises);

        // Delete image document
        await DeliveryPartnersImages.deleteOne({ email });
        console.log(`Temporary images for email ${email} deleted after timeout`);
      }
    }, 60 * 15000); // 15 minutes

    res.status(201).json({
      message: 'Images uploaded successfully. complete your registration within 15minutes',
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

// module.exports = router;
