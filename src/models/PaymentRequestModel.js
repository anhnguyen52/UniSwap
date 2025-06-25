const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  type: {
    type: String,
    enum: ['posting_fee', 'boost_fee', 'renew_fee'],
    required: true
  },
  amount: { type: Number, required: true },
  isPaid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null }
});

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
