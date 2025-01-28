const mongoose = require('mongoose');

const grocerySchema = new mongoose.Schema({
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

const Grocery = mongoose.model('Grocery', grocerySchema);

module.exports = Grocery;
