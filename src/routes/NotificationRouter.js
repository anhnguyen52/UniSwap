const express = require('express');
const router = express.Router();
const Notification = require('../models/NotificationModel');
const { io } = require('../index');
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const notifications = await Notification.find({ userId }).populate('postId').populate('extraData.requestId');
  res.json(notifications);
});

router.post('/create', async (req, res) => {
  try {
    const newNotification = new Notification(req.body);
    await newNotification.save();

    // Gửi socket đến client (real-time)
    const room = `notification_${req.body.userId}`;
    io.to(room).emit('newNotification', newNotification);

    // Cập nhật badge số lượng
    const unreadCount = await Notification.countDocuments({
      userId: req.body.userId,
      isRead: false
    });
    io.to(room).emit('notificationUnreadCount', unreadCount);

    res.status(201).json(newNotification);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo thông báo' });
  }
});

module.exports = router;
