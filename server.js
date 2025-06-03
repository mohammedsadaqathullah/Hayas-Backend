const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Grocery = require('./models/Grocery'); // Assuming this is the correct path for your Grocery model
const Food = require('./models/Food');
const VegetablesAndFruits = require('./models/VegetablesAndFruits');

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
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newGrocery = new Grocery({ imageURL, title, description, quantityOne, quantityTwo });
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
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedGrocery = await Grocery.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
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

// Routes for Food
app.post('/food', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newFood = new Food({ imageURL, title, description, quantityOne, quantityTwo });
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
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedFood = await Food.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
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
// Routes for Vegetables and Fruits
app.post('/vegetables-and-fruits', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const newItem = new VegetablesAndFruits({ imageURL, title, description, quantityOne, quantityTwo });
        await newItem.save();
        res.status(201).json({ message: 'Item created successfully', item: newItem });
    } catch (err) {
        res.status(400).json({ error: 'Error creating item', details: err });
    }
});

app.get('/vegetables-and-fruits', async (req, res) => {
    try {
        const items = await VegetablesAndFruits.find();
        res.status(200).json(items);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching items', details: err });
    }
});

app.get('/vegetables-and-fruits/:id', async (req, res) => {
    try {
        const item = await VegetablesAndFruits.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching item', details: err });
    }
});

app.put('/vegetables-and-fruits/:id', async (req, res) => {
    try {
        const { imageURL, title, description, quantityOne, quantityTwo } = req.body;
        const updatedItem = await VegetablesAndFruits.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, quantityOne, quantityTwo },
            { new: true }
        );
        if (!updatedItem) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item updated successfully', item: updatedItem });
    } catch (err) {
        res.status(400).json({ error: 'Error updating item', details: err });
    }
});

app.delete('/vegetables-and-fruits/:id', async (req, res) => {
    try {
        const deletedItem = await VegetablesAndFruits.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting item', details: err });
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
