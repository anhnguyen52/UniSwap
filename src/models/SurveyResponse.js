const { default: mongoose } = require("mongoose");

const surveyResponseSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: "Survey", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  answers: [
    {
      question: String,
      answer: mongoose.Schema.Types.Mixed // string / array / text
    },
  ],
  // Phần đánh giá website nằm trong survey
  rating: { type: Number, min: 1, max: 5 },
  comment: { type: String },

  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SurveyResponse", surveyResponseSchema);
