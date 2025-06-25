const express = require("express");
const router = express.Router();
const messageController = require('../controllers/MessageController');

router.get("/:conversationId", messageController.getMessages);
// router.get("/", messageController.getOrCreateConversation);



module.exports = router;
