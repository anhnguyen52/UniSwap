const express = require('express');
const router = express.Router();
const Notification = require('../models/NotificationModel');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const notifications = await Notification.find({ userId }).populate('postId').populate('extraData.requestId');
  res.json(notifications);
});

router.post('/create', async (req, res) => {
  const newNotification = new Notification(req.body);
  await newNotification.save();
  res.status(201).json(newNotification);
});

module.exports = router;
