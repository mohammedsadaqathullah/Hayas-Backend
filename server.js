const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Product = require('./models/Product');  // Import Product model

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

// Routes

// Create a new Product
app.post('/products', async (req, res) => {
    try {
        const { imageURL, title, description, halfKg, oneKg } = req.body;
        const newProduct = new Product({ imageURL, title, description, halfKg, oneKg });
        await newProduct.save();
        res.status(201).json({ message: 'Product created successfully', product: newProduct });
    } catch (err) {
        res.status(400).json({ error: 'Error creating product', details: err });
    }
});

// Get all Products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching products', details: err });
    }
});

// Get a single Product by ID
app.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching product', details: err });
    }
});

// Update a Product by ID
app.put('/products/:id', async (req, res) => {
    try {
        const { imageURL, title, description, halfKg, oneKg } = req.body;
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { imageURL, title, description, halfKg, oneKg },
            { new: true } // Returns the updated document
        );
        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (err) {
        res.status(400).json({ error: 'Error updating product', details: err });
    }
});

// Delete a Product by ID
app.delete('/products/:id', async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting product', details: err });
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
