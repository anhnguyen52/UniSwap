const express = require("express");
const router = express.Router();
const messageController = require('../controllers/MessageController');

router.get("/", messageController.getOrCreateConversation);
router.get("/list", messageController.getUserConversations);



module.exports = router;
