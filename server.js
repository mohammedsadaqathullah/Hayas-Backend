const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Grocery = require('./models/Grocery'); // Assuming this is the correct path for your Grocery model
const Food = require('./models/Food');

const app = express();

// Middleware
app.use(express.json());  // To parse JSON data
app.use(cors());  // Enable CORS

// MongoDB Connection
mongoose.connect('mongodb+srv://hayasbackend:HayasBackend.dev2024@cluster0.xyhmf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('MongoDB connected successfully!');
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

// Routes for Grocery
app.post('/grocery', async (req, res) => {
    try {
        const { imageURL, title, description, halfKg, oneKg } = req.body;
        const newGrocery = new Grocery({ imageURL, title, description, halfKg, oneKg });
        await newGrocery.save();
        res.status(201).json({ message: 'Product created successfully', grocery: newGrocery });
    } catch (err) {
        res.status(400).json({ error: 'Error creating product', details: err });
    }
});

app.get('/grocery', async (req, res) => {
    try {
        const grocery = await Grocery.find();  // Fetch all products from MongoDB
        res.status(200).json(grocery);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching products', details: err });
    }
});

app.get('/grocery/:id', async (req, res) => {
    try {
        const grocery = await Grocery.findById(req.params.id);
        if (!grocery) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json(grocery);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching product', details: err });
    }
});

app.put('/grocery/:id', async (req, res) => {
    try {
        const { imageURL, title, description, halfKg, oneKg } = req.body;
        const updatedGrocery = await Grocery.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, halfKg, oneKg },
            { new: true }
        );
        if (!updatedGrocery) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ message: 'Product updated successfully', grocery: updatedGrocery });
    } catch (err) {
        res.status(400).json({ error: 'Error updating product', details: err });
    }
});

app.delete('/grocery/:id', async (req, res) => {
    try {
        const deletedGrocery = await Grocery.findByIdAndDelete(req.params.id);
        if (!deletedGrocery) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting product', details: err });
    }
});

// Routes for Food (New Endpoints)
app.post('/food', async (req, res) => {
    try {
        const { imageURL, title, description, halfKg, oneKg } = req.body;
        const newFood = new Food({ imageURL, title, description, halfKg, oneKg });
        await newFood.save();
        res.status(201).json({ message: 'Food created successfully', food: newFood });
    } catch (err) {
        res.status(400).json({ error: 'Error creating food', details: err });
    }
});

app.get('/food', async (req, res) => {
    try {
        const food = await Food.find();  // Fetch all food items from MongoDB
        res.status(200).json(food);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching food', details: err });
    }
});

app.get('/food/:id', async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        if (!food) {
            return res.status(404).json({ error: 'Food not found' });
        }
        res.status(200).json(food);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching food', details: err });
    }
});

app.put('/food/:id', async (req, res) => {
    try {
        const { imageURL, title, description, halfKg, oneKg } = req.body;
        const updatedFood = await Food.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, halfKg, oneKg },
            { new: true }
        );
        if (!updatedFood) {
            return res.status(404).json({ error: 'Food not found' });
        }
        res.status(200).json({ message: 'Food updated successfully', food: updatedFood });
    } catch (err) {
        res.status(400).json({ error: 'Error updating food', details: err });
    }
});

app.delete('/food/:id', async (req, res) => {
    try {
        const deletedFood = await Food.findByIdAndDelete(req.params.id);
        if (!deletedFood) {
            return res.status(404).json({ error: 'Food not found' });
        }
        res.status(200).json({ message: 'Food deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting food', details: err });
    }
});

// Basic Route
app.get('/', (req, res) => {
    res.send('Hello, Backend is running!');
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
