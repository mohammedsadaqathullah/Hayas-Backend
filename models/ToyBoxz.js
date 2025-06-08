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
    sizeSmall: {  // Changed from quantityOne
        type: String,
        required: true
    },
    sizeLarge: {  // Changed from quantityTwo
        type: String,
        required: true
    },
    datePosted: {
        type: Date,
        default: Date.now
    }
});

const ToyBoxz = mongoose.model('ToyBoxz', toySchema);

module.exports = ToyBoxz;
