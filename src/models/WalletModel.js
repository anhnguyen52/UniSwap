const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true  // Mỗi user chỉ có 1 ví
    },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'VND' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Wallet', walletSchema);
