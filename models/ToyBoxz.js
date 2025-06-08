const mongoose = require('mongoose');

const toySchema = new mongoose.Schema({
    imageURL: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quantityOne: {  // Changed from halfKg
        type: String,
        required: true
    },
    quantityTwo: {  // Changed from oneKg
        type: String,
        required: false
    },
    datePosted: {
        type: Date,
        default: Date.now
    }
});

const ToyBoxz = mongoose.model('ToyBoxz', toySchema);

module.exports = ToyBoxz;
