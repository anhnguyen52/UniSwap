// models/Advertisement.js

const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    imageUrl: { type: String, required: true },
    link: { type: String, required: true },
    position: {
        type: String,
        enum: ['left', 'right', 'top_banner'],
        required: true
    },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: { type: Number, required: true }, // số ngày
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'active', 'waiting', 'expired'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Advertisement', advertisementSchema);
