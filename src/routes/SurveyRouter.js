
const express = require("express");
const router = express.Router();
const Survey = require("../models/Survey");
const User = require("../models/UserModel");
const Notification = require("../models/NotificationModel");
const SurveyResponse = require("../models/SurveyResponse");

router.post("/", async (req, res) => {
  try {
    const { title, description, questions, createdBy } = req.body;

    const survey = await Survey.create({
      title,
      description,
      questions,
      createdBy,
    });

    const users = await User.find({}, "_id");

    const notifications = users.map((user) => ({
      userId: user._id,
      type: "survey",
      title: "Khảo sát mới!",
      message: `Hãy tham gia khảo sát: "${title}" để nhận 2 bài đăng miễn phí.`,
      extraData: {
        surveyId: survey._id,
      },
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      message: "Survey created and notifications sent!",
      survey,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create survey" });
  }
});

router.get("/", async (req, res) => {
  try {
    const surveys = await Survey.find().populate("createdBy", "email");
    res.json(surveys);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id).populate("createdBy", "email");
    if (!survey) return res.status(404).json({ error: "Survey not found" });
    res.json(survey);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch survey" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updatedSurvey = await Survey.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedSurvey) return res.status(404).json({ error: "Survey not found" });
    res.json(updatedSurvey);
  } catch (err) {
    res.status(500).json({ error: "Failed to update survey" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deletedSurvey = await Survey.findByIdAndDelete(req.params.id);
    if (!deletedSurvey) return res.status(404).json({ error: "Survey not found" });
    res.json({ message: "Survey deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete survey" });
  }
});


router.get("/details/:id", async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id).populate("createdBy", "email");
    if (!survey) return res.status(404).json({ error: "Survey not found" });

    const responses = await SurveyResponse.find({ surveyId: req.params.id })
      .populate("userId", "email");

    res.json({ survey, responses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch survey detail" });
  }
});
``

module.exports = router;
