const mongoose = require('mongoose');

const depositRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    imageUrl: { type: String },
}, {
    timestamps: true
});

module.exports = mongoose.model('DepositRequest', depositRequestSchema);