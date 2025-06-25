const express = require("express");
const router = express.Router();
const multer = require("multer");
const chatBotController = require('../controllers/ChatBotController');

const upload = multer({ storage: multer.memoryStorage() });

router.post("/suggest", chatBotController.getSuggestions);
router.post("/upload-image", upload.single('image'), chatBotController.uploadImage);


module.exports = router;
