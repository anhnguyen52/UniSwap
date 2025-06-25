const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'post'], // Bạn có thể mở rộng sau này: ['text', 'post', 'image', 'file', ...]
        default: 'text'
    },
    message: {
        type: String,
        default: ''
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post", // hoặc model bài đăng bạn đang dùng
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Message', messageSchema);
