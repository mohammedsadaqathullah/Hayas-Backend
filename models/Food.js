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
    halfKg: {
        type: Number,
        required: true
    },
    oneKg: {
        type: Number,
        required: true
    },
    datePosted: {
        type: Date,
        default: Date.now
    }
});

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;
