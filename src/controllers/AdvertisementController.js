const Advertisement = require("../models/AdvertisementModel");
const Wallet = require("../models/WalletModel");
const Transaction = require('../models/TransactionModel');
// 1. User gửi yêu cầu
exports.createAd = async (req, res) => {
  try {
    const { userId, imageUrl, link, position, price, startDate, durationDays } =
      req.body;

    // Kiểm tra xem người dùng đã có quảng cáo hoạt động chưa
    const existing = await Advertisement.findOne({
      user: userId,
      status: "approved",
      expiresAt: { $gt: new Date() },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "⚠️ Bạn đang có quảng cáo đang hoạt động." });
    }

    // Tạo quảng cáo mới
    const start = new Date(startDate);
    const end = new Date(start.getTime() + durationDays * 86400000);

    const ad = new Advertisement({
      user: userId,
      imageUrl,
      link,
      position,
      price,
      startDate: start,
      duration: durationDays,
      endDate: end,
      status: "pending",
    });

    await ad.save();
    res.status(201).json({ message: "✅ Gửi yêu cầu thành công", ad });
  } catch (err) {
    console.error("❌ Lỗi tạo quảng cáo:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2. Admin duyệt
exports.approveAd = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id).populate("user");
    if (!ad || ad.status !== "pending") {
      return res.status(400).json({ message: "Không hợp lệ hoặc đã xử lý" });
    }

    const wallet = await Wallet.findOne({ user: ad.user._id });
    if (!wallet || wallet.balance < ad.price) {
      return res.status(400).json({ message: "Không đủ tiền" });
    }

    // Trừ tiền
    wallet.balance -= ad.price;
    await wallet.save();

    // ✅ Ghi lịch sử giao dịch
    await Transaction.create({
      wallet: wallet._id,
      type: 'purchase',
      amount: ad.price,
      balanceAfter: wallet.balance,
      description: 'Mua quảng cáo'
    });

    // Duyệt quảng cáo
    ad.status = "approved";
    ad.expiresAt = ad.endDate;
    await ad.save();

    // ❗ Tự động từ chối các quảng cáo khác của user còn pending
    await Advertisement.updateMany(
      { _id: { $ne: ad._id }, user: ad.user._id, status: "pending" },
      { $set: { status: "rejected" } }
    );

    res.json({ message: "✅ Duyệt thành công và đã trừ tiền + ghi giao dịch", ad });
  } catch (err) {
    console.error("❌ Lỗi approveAd:", err);
    res.status(500).json({ error: err.message });
  }
};



// 3. Get danh sách đã duyệt (hiện tại đang chạy)
exports.getApprovedAds = async (req, res) => {
  try {
    const ads = await Advertisement.find({
      status: "approved",
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) {
    console.error("❌ Lỗi getApprovedAds:", err);
    res.status(500).json({ error: err.message });
  }
};

// 4. Get pending (chờ duyệt)
exports.getPendingAds = async (req, res) => {
  try {
    const ads = await Advertisement.find({ status: "pending" }).sort({
      createdAt: -1,
    });
    res.json(ads);
  } catch (err) {
    console.error("❌ Lỗi getPendingAds:", err);
    res.status(500).json({ error: err.message });
  }
};

// 5. Dùng cho cronjob → tự động hết hạn
exports.expireAds = async () => {
  try {
    const now = new Date();
    const result = await Advertisement.updateMany(
      { status: "approved", expiresAt: { $lte: now } },
      { status: "expired" }
    );
  } catch (err) {
    console.error("❌ Lỗi expireAds cronjob:", err);
  }
};

// 6. Get ads của user (My Ads) → để user xem trạng thái
exports.getMyAds = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    const ads = await Advertisement.find({ user: userId }).sort({
      createdAt: -1,
    });
    res.json(ads);
  } catch (err) {
    console.error("❌ Lỗi getMyAds:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.rejectAd = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);

    if (!ad || ad.status !== "pending") {
      return res.status(400).json({ message: "Không hợp lệ hoặc đã xử lý" });
    }

    ad.status = "rejected";
    await ad.save();

    res.json({ message: "❌ Đã từ chối quảng cáo", ad });
  } catch (err) {
    console.error("❌ Lỗi rejectAd:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.checkHasActiveAd = async (req, res) => {
  try {
    const { userId } = req.params;

    const hasAd = await Advertisement.exists({
      user: userId,
      status: { $in: ['approved', 'active'] }, // nếu bạn dùng status khác, điều chỉnh tại đây
      endDate: { $gt: new Date() } // vẫn còn hiệu lực
    });

    res.json({ hasActiveAd: !!hasAd });
  } catch (err) {
    console.error('❌ Lỗi checkHasActiveAd:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getActiveAdvertisements = async (req, res) => {
  try {
    const now = new Date();

    // Bước 1: cập nhật các quảng cáo đã được approved và đến ngày bắt đầu thành active
    await Advertisement.updateMany(
      {
        status: 'approved',
        startDate: { $lte: now },
        endDate: { $gte: now }
      },
      { $set: { status: 'active' } }
    );

    // Bước 2: lấy tất cả quảng cáo đang active
    const activeAds = await Advertisement.find({
      status: 'active',
      endDate: { $gte: now }
    }).sort({ startDate: 1 });

    res.json(activeAds);
  } catch (err) {
    console.error('❌ Lỗi getActiveAdvertisements:', err);
    res.status(500).json({ error: err.message });
  }
};


