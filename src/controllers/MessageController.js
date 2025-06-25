const mongoose = require('mongoose');
const Message = require('../models/MessageModel');
const Conversation = require('../models/ConversationModel');

//Hàm tìm hoặc tạo conversation chỉ theo sender + receiver
const findOrCreateConversation = async (senderId, receiverId) => {
    if (!senderId || !receiverId) throw new Error('senderId và receiverId là bắt buộc');

    const query = {
        members: { $all: [senderId, receiverId] }
    };

    let conversation = await Conversation.findOne(query);

    if (!conversation) {
        conversation = await Conversation.create({
            members: [senderId, receiverId]
        });
    }

    return conversation;
};

// Middleware Express gọi findOrCreateConversation
const getOrCreateConversation = async (req, res, next) => {
    try {
        const { senderId, receiverId } = req.query;
        const conversation = await findOrCreateConversation(senderId, receiverId);
        res.json(conversation);
    } catch (err) {
        next(err);
    }
};


//Lấy toàn bộ tin nhắn trong conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!conversationId) {
            return res.status(400).json({ error: "conversationId is required" });
        }

        const messages = await Message.find({ conversationId }).populate('post').sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};
const getUserConversations = async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: "Thiếu userId" });
    }

    try {
        const conversations = await Conversation.find({ members: userId }).populate("members", "id name email avatar");

        const results = await Promise.all(
            conversations.map(async (conv) => {
                // người còn lại
                const participant = conv.members.find((m) => m._id.toString() !== userId);
                // tin nhắn mới nhất
                const lastMessage = await Message.findOne({ conversationId: conv._id })
                    .sort({ createdAt: -1 });

                return {
                    _id: conv._id,
                    participant: participant
                        ? {
                            id: participant._id,
                            name: participant.name || participant.email || "Người dùng",
                            avatar: participant.avatar
                        }
                        : null,
                    lastMessage: lastMessage
                        ? {
                            type: lastMessage.type,
                            message: lastMessage.message || null,
                        }
                        : null,
                };
            })
        );
        res.status(200).json(results);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách hội thoại:", err);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

module.exports = {
    getMessages,
    getOrCreateConversation,
    findOrCreateConversation,
    getUserConversations
};
