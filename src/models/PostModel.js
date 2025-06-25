const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    images: [{ type: String }],

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    location: {
      city: { type: String },
      district: { type: String },
    },

    status: {
      type: String,
      enum: ["active", "sold", "inactive"],
      default: "active",
    },

    attributes: {
      brand: { type: String },
      condition: { type: String },
    },

    moderation: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      approvedAt: { type: Date, default: null },
      rejectedReason: { type: String, default: null },
      rejectedAt: { type: Date, default: null },
      needPayment: { type: Boolean, default: false },
    },
    paymentRequests: [
      { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRequest" },
    ],
    // Quản lý giao dịch đơn giản
    transaction: {
      buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      soldAt: { type: Date, default: null }, // Thời điểm người bán xác nhận
      purchasedAt: { type: Date, default: null }, // Thời điểm người mua xác nhận
      status: {
        type: String,
        enum: ["pending", "sold", "completed"], // Chỉ cần pending và completed
        default: "pending",
      },
    },

    // Lưu đánh giá
    rating: {
      stars: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: null },
      ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      ratedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Middleware để đồng bộ status của post với transaction.status
postSchema.pre("save", function (next) {
  if (this.transaction.status === "completed") {
    this.status = "sold";
  } else {
    this.status = "active"; // Hoặc "inactive" nếu cần
  }
  next();
});

module.exports = mongoose.model("Post", postSchema);
