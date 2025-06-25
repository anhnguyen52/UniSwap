const mongoose = require("mongoose");

const surveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  questions: [
    {
      question: { type: String, required: true },
      type: {
        type: String,
        enum: ["radio", "checkbox", "text"],
        default: "radio",
      },
      options: [String],
    },
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model("Survey", surveySchema);
