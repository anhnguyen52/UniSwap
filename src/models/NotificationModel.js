const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  title: String,
  message: String,
  extraData: {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentRequest' },
    reason: String,
    rating: Number,
    surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey' },
  },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
