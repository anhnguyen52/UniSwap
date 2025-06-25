// controllers/postController.js
const Post = require("../models/PostModel");
const Notification = require("../models/NotificationModel");
const PaymentRequestModel = require("../models/PaymentRequestModel");
const User = require("../models/UserModel");

// Create post
const createPost = async (req, res) => {
  try {
    const newPost = new Post(req.body);
    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all posts
const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate("userId");
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPendingPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate("userId");
    const pendingPosts = posts.filter(
      (post) => post.moderation.status === "pending"
    );
    res.status(200).json(pendingPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getApprovedPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate({
        path: "userId",
        select: "-password, -avatar",
      })
      .populate("paymentRequests");
    const approvedPosts = posts.filter(
      (post) => post.moderation.status === "approved"
    );
    res.status(200).json(approvedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getApprovedAndPaidPosts = async (req, res) => {
  try {
    const { filter, limit, categoryId, sort } = req.query;

    let query = {
      "moderation.status": "approved",
      status: "active"
    };

    if (filter) {
      query.title = { $regex: filter, $options: "i" };
    }
    if (categoryId) {
      query.category = categoryId;
    }

    let sortOption = {};
    if (sort === "priceAsc") {
      sortOption.price = 1;
    } else if (sort === "priceDesc") {
      sortOption.price = -1;
    } else if (sort === "newest") {
      sortOption.createdAt = -1;
    }

    const posts = await Post.find(query)
      .populate("paymentRequests")
      .populate("category", "name")
      .populate("userId")
      .sort(sortOption)
      .limit(parseInt(limit) || 0);

    const approvedAndVisiblePosts = posts.filter((post) => {
      const paid = post.paymentRequests?.some(
        (req) => req.type === "posting_fee" && req.isPaid === true
      );
      const free = post.moderation?.needPayment === false;
      return paid || free;
    });

    res.status(200).json(approvedAndVisiblePosts);
  } catch (error) {
    console.error("Lỗi lấy bài đăng đã duyệt & hiển thị:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};


const getRejectedPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate("userId");
    const rejectedPosts = posts.filter(
      (post) => post.moderation.status === "rejected"
    );
    res.status(200).json(rejectedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get post by ID
const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate({
      path: "userId",
      select: "-password -refresh_token -access_token -__v", // loại bỏ trường nhạy cảm
    });
    if (!post) return res.status(404).json({ message: "Post not found" });

    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPostByUserId = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.id });
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update post
const updatePost = async (req, res) => {
  try {
    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Post not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const deleted = await Post.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const approvePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const adminId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const user = await User.findById(post.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let notification = null;

    if (user.freePosts > 0) {
      user.freePosts -= 1;
      await user.save();

      post.moderation.status = "approved";
      post.moderation.adminId = adminId;
      post.moderation.approvedAt = new Date();
      post.moderation.needPayment = false;
      await post.save();

      notification = await Notification.create({
        userId: post.userId,
        type: "post_approved",
        postId: post._id,
        title: "Bài đăng đã hiển thị",
        message: `Bài đăng "${post.title}" đã được duyệt và đang hiển thị nhờ lượt miễn phí.`,
        isRead: false,
        createdAt: new Date(),
      });

      return res.status(200).json({
        message: "Post approved using free post",
        post,
        notification,
      });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $set: {
          "moderation.status": "approved",
          "moderation.adminId": adminId,
          "moderation.approvedAt": new Date(),
          "moderation.needPayment": true,
        },
      },
      { new: true }
    );

    const paymentRequest = await PaymentRequestModel.create({
      userId: updatedPost.userId,
      postId: updatedPost._id,
      type: "posting_fee",
      amount: 5000,
    });

    updatedPost.paymentRequests.push(paymentRequest._id);
    await updatedPost.save();

    notification = await Notification.create({
      userId: updatedPost.userId,
      type: "payment_required",
      postId: updatedPost._id,
      title: "Bài đăng đã được duyệt",
      message: `Bài đăng "${updatedPost.title}" đã được duyệt. Vui lòng thanh toán để hiển thị bài đăng.`,
      isRead: false,
      createdAt: new Date(),
      extraData: {
        requestId: paymentRequest._id,
      },
    });

    res
      .status(200)
      .json({ message: "Post approved - payment required", post: updatedPost, notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};


const rejectPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const adminId = req.user._id;
    const { rejectedReason } = req.body;

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $set: {
          "moderation.status": "rejected",
          "moderation.adminId": adminId,
          "moderation.approvedAt": null,
          "moderation.rejectedReason": rejectedReason,
        },
      },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Notification.create({
      userId: updatedPost.userId,
      type: "post_rejected",
      postId: updatedPost._id,
      title: "Bài đăng bị từ chối",
      message: `Bài đăng "${updatedPost.title}" đã bị từ chối. Lý do: ${rejectedReason}`,
      extraData: {
        reason: rejectedReason,
      },
      isRead: false,
      createdAt: new Date(),
    });

    res.status(200).json({ message: "Post rejected", post: updatedPost });
  } catch (error) {
    console.error("rejectPost error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


//đông thêm
const markAsSold = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const { buyerId } = req.body;

    const post = await Post.findById(id);

    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId.toString() !== sellerId) return res.status(403).json({ message: "Only seller can mark as sold" });
    if (post.transaction.status === "completed") return res.status(400).json({ message: "Post already sold" });

    post.transaction.buyerId = buyerId;
    post.transaction.soldAt = new Date();
    post.transaction.status = "sold"; // Chỉ chuyển thành "sold" khi người bán xác nhận

    await post.save();

    res.status(200).json({ message: "Post marked as sold", post });
  } catch (error) {
    console.error("markAsSold error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

const markAsPurchased = async (req, res) => {
  try {
    const postId = req.params.id;
    const buyerId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.transaction.buyerId.toString() !== buyerId) return res.status(403).json({ message: "Only buyer can mark as purchased" });
    if (post.transaction.status === "completed") return res.status(400).json({ message: "Post already purchased" });
    if (post.transaction.status !== "sold") return res.status(400).json({ message: "Post not yet sold" });

    post.transaction.purchasedAt = new Date();
    post.transaction.status = "completed"; // Chuyển thành "completed" khi người mua xác nhận

    await post.save();
    res.status(200).json({ message: "Post marked as purchased", post });
  } catch (error) {
    console.error("markAsPurchased error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
const getPurchasedPosts = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const posts = await Post.find({
      'transaction.buyerId': buyerId,
      'transaction.status': 'completed',
    }).populate('userId', 'name').select('title price images rating transaction');
    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching purchased posts:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

const submitRating = async (req, res) => {
  try {
    const postId = req.params.id;
    const buyerId = req.user.id;
    const { stars, comment } = req.body;

    const post = await Post.findById(postId);

    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.transaction.status !== 'completed') return res.status(400).json({ message: 'Transaction not completed' });
    if (post.transaction.buyerId.toString() !== buyerId) return res.status(403).json({ message: 'Only buyer can rate' });
    if (post.rating.ratedAt) return res.status(400).json({ message: 'Post already rated' });

    post.rating.stars = stars;
    post.rating.comment = comment;
    post.rating.ratedBy = buyerId;
    post.rating.ratedAt = new Date();

    await post.save();
    res.status(200).json({ message: 'Rating submitted', post });
  } catch (error) {
    console.error('submitRating error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

const getRating = async (req, res) => {
  try {
    const sellerId = req.user.id;

    const posts = await Post.find({
      'userId': sellerId,
      'rating.ratedAt': { $exists: true, $ne: null },
      'transaction.status': 'completed',
    }).populate('userId', 'name').select('title price images rating transaction');

    if (!posts || posts.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAverageRating = async (req, res) => {
  try {
    const sellerId = req.query.sellerId; // Lấy sellerId từ query parameter
    if (!sellerId) {
      return res.status(400).json({ message: 'Seller ID is required' });
    }

    // Tìm tất cả các bài đăng của người bán có đánh giá
    const posts = await Post.find({
      'userId': sellerId,
      'rating.ratedAt': { $exists: true, $ne: null },
      'transaction.status': 'completed',
    }).select('rating');

    if (!posts || posts.length === 0) {
      return res.status(200).json({ averageRating: 0, totalRatings: 0 });
    }

    // Tính trung bình số sao
    const ratings = posts.map(post => post.rating?.stars || 0).filter(stars => stars > 0);
    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b) / ratings.length : 0;
    const totalRatings = ratings.length;

    res.status(200).json({ averageRating, totalRatings });
  } catch (error) {
    console.error('Error fetching average rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  getPostByUserId,
  updatePost,
  deletePost,
  approvePost,
  rejectPost,
  getPendingPosts,
  getApprovedPosts,
  getRejectedPosts,
  getApprovedAndPaidPosts,
  markAsSold,
  markAsPurchased,
  getPurchasedPosts,
  submitRating,
  getRating,
  getAverageRating
};
