const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
    members: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    ],
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        default: null // Có thể là null nếu không từ post
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Conversation", conversationSchema);
