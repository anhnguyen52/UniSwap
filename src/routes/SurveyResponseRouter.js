const express = require("express");
const router = express.Router();
const SurveyResponse = require("../models/SurveyResponse");
const User = require("../models/UserModel");

router.post("/:surveyId", async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { userId, answers, rating, comment } = req.body;

    // Kiểm tra nếu đã gửi trước đó
    const existing = await SurveyResponse.findOne({ surveyId, userId });
    if (existing) {
      return res.status(400).json({ message: "You already submitted this survey." });
    }

    // Lưu phản hồi
    await SurveyResponse.create({
      surveyId,
      userId,
      answers,
      rating,
      comment
    });

    // Tặng 2 bài đăng miễn phí cho user
    await User.findByIdAndUpdate(userId, { $inc: { freePosts: 2 } });

    res.status(201).json({ message: "Survey response submitted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit survey response", error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const responses = await SurveyResponse.find()
      .populate("surveyId", "title")
      .populate("userId", "email");
    res.json(responses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch survey responses" });
  }
});

router.get("/:surveyId", async (req, res) => {
  try {
    const responses = await SurveyResponse.find({ surveyId: req.params.surveyId })
      .populate("userId", "email");
    res.json(responses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch responses for this survey" });
  }
});

router.get("/:surveyId/user/:userId", async (req, res) => {
  try {
    const { surveyId, userId } = req.params;
    const response = await SurveyResponse.findOne({ surveyId, userId });
    if (!response) {
      return res.status(404).json({ message: "No response found for this user" });
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user's survey response" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await SurveyResponse.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Survey response not found" });
    }
    res.json({ message: "Survey response deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete survey response" });
  }
});

module.exports = router;
