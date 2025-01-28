const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
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
        required: true
    },
    datePosted: {
        type: Date,
        default: Date.now
    }
});

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;
