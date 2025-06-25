const express = require("express");
const dotenv = require('dotenv');
const mongoose = require("mongoose");
const routes = require('./routes');
const path = require('path');
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require('cors');
const Message = require('./models/MessageModel');
const Conversation = require('./models/ConversationModel');
const Post = require('./models/PostModel');
const ObjectId = mongoose.Types.ObjectId;
const { findOrCreateConversation } = require('./controllers/MessageController');
const { expireAds } = require('./controllers/AdvertisementController');
const cron = require('node-cron');

dotenv.config();

const app = express();
const http = require("http").createServer(app); // Create HTTP server
const { Server } = require("socket.io"); // Import Socket.IO
const io = new Server(http, {
    cors: {
        origin: "*",
        credentials: true
    }
});

const port = process.env.PORT || 3001;

//socket.io
io.on("connection", (socket) => {
    socket.on("joinRoom", ({ conversationId }) => {
        if (conversationId) {
            socket.join(conversationId);
        }
    });

    socket.on("sendMessage", async (data, callback) => {
        try {
            const { senderId, receiverId, message, postId, type = 'text', conversationId } = data;

            const conversation = await findOrCreateConversation(senderId, receiverId);

            const newMessage = await Message.create({
                conversationId: conversation._id,
                senderId,
                message: type === 'text' ? message : null,
                post: type === 'post' ? postId : null,
                type,
                isRead: false,
                createdAt: new Date(),
            });

            let messageToSend = newMessage.toObject();

            if (type === 'post' && postId) {
                const post = await Post.findById(postId).select('title price description images');
                if (post) {
                    messageToSend.post = post.toObject();
                }
            }

            io.to(conversation._id.toString()).emit("receiveMessage", messageToSend);
            // Thông báo tin nhắn mới cho receiver
            io.to(receiverId).emit("newMessage", { conversationId: conversation._id });

            // Cập nhật số lượng tin nhắn chưa đọc
            const unreadCount = await Message.countDocuments({
                conversationId: conversation._id,
                isRead: false,
                senderId: { $ne: receiverId },
            });
            io.to(receiverId).emit("unreadCount", unreadCount);

            // Gửi callback với thông tin tin nhắn đã tạo
            if (callback) {
                callback(messageToSend);
            }
        } catch (err) {
            console.error("Error sending message:", err);
            if (callback) {
                callback({ error: "Lỗi gửi tin nhắn" });
            }
            socket.emit("errorMessage", { message: "Lỗi gửi tin nhắn" });
        }
    });

    socket.on("getUnreadCount", async (userId) => {
        try {
            // Tính tổng số tin nhắn chưa đọc của người dùng trong tất cả cuộc trò chuyện
            const conversations = await Conversation.find({ members: userId });
            const conversationIds = conversations.map((conv) => conv._id);

            const unreadCount = await Message.countDocuments({
                conversationId: { $in: conversationIds },
                isRead: false,
                senderId: { $ne: userId }, // Không tính tin nhắn do chính người dùng gửi
            });

            socket.emit("unreadCount", unreadCount);
        } catch (err) {
            console.error("Error in getUnreadCount:", err);
        }
    });

    // Thêm sự kiện để đánh dấu tin nhắn đã đọc
    socket.on("markAsRead", async ({ conversationId, userId }) => {
        try {
            await Message.updateMany(
                {
                    conversationId,
                    isRead: false,
                    senderId: { $ne: userId }, // Chỉ cập nhật tin nhắn không phải do người dùng gửi
                },
                { $set: { isRead: true } }
            );

            // Cập nhật lại unreadCount
            const conversations = await Conversation.find({ members: userId });
            const conversationIds = conversations.map((conv) => conv._id);

            const unreadCount = await Message.countDocuments({
                conversationId: { $in: conversationIds },
                isRead: false,
                senderId: { $ne: userId },
            });

            socket.emit("unreadCount", unreadCount);
        } catch (err) {
            console.error("Error in markAsRead:", err);
        }
    });

    socket.on("getConversations", async ({ userId }) => {
        try {
            const conversations = await Conversation.aggregate([
                { $match: { members: { $in: [new ObjectId(userId)] } } },
                {
                    $lookup: {
                        from: "messages",
                        localField: "_id",
                        foreignField: "conversationId",
                        as: "messages",
                    },
                },
                {
                    $addFields: {
                        lastMessage: { $arrayElemAt: [{ $slice: ["$messages", -1] }, 0] },
                        unreadCount: {
                            $size: {
                                $filter: {
                                    input: "$messages",
                                    as: "msg",
                                    cond: {
                                        $and: [
                                            { $eq: ["$$msg.isRead", false] },
                                            { $ne: ["$$msg.senderId", new ObjectId(userId)] },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                { $unwind: "$members" },
                { $match: { members: { $ne: new ObjectId(userId) } } },
                {
                    $lookup: {
                        from: "users",
                        localField: "members",
                        foreignField: "_id",
                        as: "userInfo",
                    },
                },
                { $unwind: "$userInfo" },
                {
                    $project: {
                        _id: 1,
                        name: "$userInfo.name",
                        email: "$userInfo.email",
                        avatar: "$userInfo.avatar",
                        userId: "$userInfo._id",
                        postId: "$lastMessage.post._id",
                        lastMessage: {
                            type: "$lastMessage.type",
                            message: "$lastMessage.message",
                            post: {
                                _id: "$lastMessage.post._id",
                                title: "$lastMessage.post.title",
                                price: "$lastMessage.post.price",
                            },
                        },
                        lastMessageDate: "$lastMessage.createdAt",
                        unreadCount: 1,
                    },
                },
                { $sort: { lastMessageDate: -1 } },
            ]);

            socket.emit("conversationsList", conversations);
        } catch (err) {
            console.error("Error in getConversations:", err);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
routes(app);
// Cronjob auto expire quảng cáo
cron.schedule('0 0 * * *', () => {
    console.log('⏰ Cronjob running...');
    expireAds();
});
//connet mongodb
mongoose.connect(process.env.DB_CONNECTION_CLOUD, {
    dbName: process.env.DB_NAME,
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log("✅ Connected to MongoDB Atlas");
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
    });

http.listen(port, () => {
    console.log(`✅ Server is running on port ${port}`);
});