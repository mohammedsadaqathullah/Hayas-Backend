const mongoose = require('mongoose');

module.exports = () => {
    mongoose.connect('mongodb+srv://hayasbackend:HayasBackend.dev2024@cluster0.xyhmf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('MongoDB connected successfully!'))
    .catch((err) => console.error('MongoDB connection error:', err));
};
