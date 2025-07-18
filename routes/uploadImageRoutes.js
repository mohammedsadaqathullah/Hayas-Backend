const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const UploadedImage = require('../models/UploadedImage');

const router = express.Router();
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });


// 1️⃣ POST /api/upload-images — Upload multiple images with a name
router.post('/', upload.array('uploadImage'), async (req, res) => {
  const { name } = req.body;
  const files = req.files;

  if (!name || !files || files.length === 0) {
    return res.status(400).json({ error: 'Name and at least one image are required' });
  }

  try {
    let doc = await UploadedImage.findOne({ name });
    if (!doc) doc = new UploadedImage({ name, images: [] });

    files.forEach((file) => {
      const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      doc.images.push({ url, filename: file.filename });
    });

    await doc.save();
    res.status(201).json({ message: 'Images uploaded successfully', data: doc });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// 2️⃣ GET /api/upload-images — Get all names with their images
router.get('/', async (req, res) => {
  try {
    const data = await UploadedImage.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});


// 3️⃣ GET /api/upload-images/:name — Get images by name
router.get('/:name', async (req, res) => {
  try {
    const doc = await UploadedImage.findOne({ name: req.params.name });
    if (!doc) return res.status(404).json({ error: 'No images found for this name' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// 4️⃣ DELETE /api/upload-images/file/:filename — Delete single image by filename
router.delete('/file/:filename', async (req, res) => {
  try {
    const doc = await UploadedImage.findOne({ 'images.filename': req.params.filename });
    if (!doc) return res.status(404).json({ error: 'Image not found' });

    doc.images = doc.images.filter((img) => img.filename !== req.params.filename);
    await doc.save();

    const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
