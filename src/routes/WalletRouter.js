const express = require("express");
const mongoose = require("mongoose");
const Wallet = require("../models/WalletModel");
const Transaction = require("../models/TransactionModel");
const DepositRequest = require("../models/DepositRequestModel");
const User = require("../models/UserModel");
const upload = require('../middleware/upload'); // nhớ import
const fs = require("fs");
const path = require("path");
const WithdrawRequest = require('../models/WithdrawRequestModel');

const router = express.Router();

/* 
--- ROUTES CỤ THỂ ĐẶT TRƯỚC ---
*/
// Gửi yêu cầu nạp tiền (người dùng) kèm ảnh chuyển khoản
router.post("/deposit/request", async (req, res) => {
    const { userId, amount, imageBase64 } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Kiểm tra image base64 có hợp lệ không
        if (!imageBase64 || !imageBase64.startsWith('data:image')) {
            return res.status(400).json({ message: "Ảnh chuyển khoản không hợp lệ" });
        }

        const request = await DepositRequest.create({
            user: userId,
            amount,
            imageUrl: imageBase64 // lưu luôn base64 vào DB
        });

        res.status(201).json({
            message: "Yêu cầu nạp tiền đã được gửi",
            request,
        });
    } catch (error) {
        console.error("❌ Lỗi gửi yêu cầu:", error);
        res.status(500).json({ message: error.message });
    }
});

// Admin duyệt yêu cầu nạp tiền

router.post("/deposit/approve/:requestId", async (req, res) => {
    const { requestId } = req.params;

    try {
        const request = await DepositRequest.findById(requestId);
        await request.populate("user");

        // Kiểm tra tính hợp lệ của request và user
        if (!request || !request.user || !request.user._id || request.status !== "pending") {
            return res.status(400).json({
                message: "Yêu cầu không tồn tại, đã xử lý, hoặc thiếu user"
            });
        }

        // Lấy userId từ request.user._id một cách an toàn
        const userIdRaw = request.user._id;
        const userId = mongoose.Types.ObjectId.isValid(userIdRaw)
            ? new mongoose.Types.ObjectId(userIdRaw)
            : null;

        if (!userId) {
            console.error("❌ userId không hợp lệ:", userIdRaw);
            return res.status(400).json({ message: "userId không hợp lệ" });
        }

        let wallet;

        // Nếu user chưa có ví → tạo ví mới
        if (!request.user.wallet) {
            try {
                console.log("🔍 Tạo ví với dữ liệu:", {
                    user: userId,
                    typeofUserId: typeof userId,
                    isValid: mongoose.Types.ObjectId.isValid(userId)
                });

                wallet = await Wallet.create({
                    user: userId,
                    balance: 0,
                });

                // Gán ví vào user
                await User.findByIdAndUpdate(userId, { wallet: wallet._id });
            } catch (e) {
                console.error("❌ Lỗi tạo ví:", e);
                return res.status(500).json({
                    message: "Lỗi khi tạo ví",
                    error: e.message,
                });
            }
        } else {
            // Nếu user đã có ví, kiểm tra ví có tồn tại
            wallet = await Wallet.findById(request.user.wallet);

            if (!wallet) {
                try {
                    wallet = await Wallet.create({
                        user: userId,
                        balance: 0,
                    });

                    await User.findByIdAndUpdate(userId, { wallet: wallet._id });
                } catch (e) {
                    console.error("❌ Lỗi tạo lại ví:", e);
                    return res.status(500).json({
                        message: "Không tìm thấy hoặc tạo lại được ví",
                        error: e.message,
                    });
                }
            }
        }

        if (!wallet) {
            return res.status(500).json({
                message: "Không tìm thấy hoặc tạo được ví",
            });
        }

        // Cộng tiền vào ví
        wallet.balance += request.amount;
        await wallet.save();

        // Tạo giao dịch
        await Transaction.create({
            wallet: wallet._id,
            type: "deposit",
            amount: request.amount,
            balanceAfter: wallet.balance,
            description: "Admin duyệt nạp tiền",
        });

        // Cập nhật trạng thái yêu cầu
        request.status = "approved";
        await request.save();

        res.json({
            message: "✅ Đã duyệt và cộng tiền vào ví",
            walletBalance: wallet.balance,
        });
    } catch (error) {
        console.error("❌ Lỗi khi duyệt yêu cầu:", error);
        res.status(500).json({ message: error.message });
    }
});




/* 
--- CÁC ROUTES CHUNG TIẾP THEO ---
*/

// Tạo ví cho user (nếu chưa có)
router.post("/create/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const existing = await Wallet.findOne({ user: userId });
        if (existing) {
            return res.status(400).json({ message: "User đã có ví" });
        }

        const wallet = await Wallet.create({ user: userId });
        await User.findByIdAndUpdate(userId, { wallet: wallet._id });

        res.status(201).json(wallet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Nạp tiền trực tiếp (admin)
router.post("/deposit/:walletId", async (req, res) => {
    const { amount } = req.body;

    try {
        const wallet = await Wallet.findById(req.params.walletId);
        if (!wallet) return res.status(404).json({ message: "Wallet not found" });

        wallet.balance += amount;
        await wallet.save();

        await Transaction.create({
            wallet: wallet._id,
            type: "deposit",
            amount,
            balanceAfter: wallet.balance,
            description: "Admin nạp thủ công",
        });

        res.json({ message: "Deposit successful", balance: wallet.balance });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Xem số dư ví
router.get("/:walletId/balance", async (req, res) => {
    try {
        const wallet = await Wallet.findById(req.params.walletId);
        if (!wallet) return res.status(404).json({ message: "Wallet not found" });
        res.json({ balance: wallet.balance, currency: wallet.currency });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Xem lịch sử giao dịch
router.get("/:walletId/transactions", async (req, res) => {
    try {
        const transactions = await Transaction.find({
            wallet: req.params.walletId,
        }).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Lấy tất cả yêu cầu nạp tiền theo user
router.get('/deposit-requests/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const requests = await DepositRequest.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Lấy tất cả yêu cầu nạp tiền (dành cho admin)
router.get('/deposit-requests', async (req, res) => {
    const { email } = req.query;

    try {
        let filter = {};

        if (email) {
            // Tìm user có email
            const user = await User.findOne({ email: new RegExp(email, 'i') });
            if (!user) return res.status(200).json([]); // Không tìm thấy user → trả về rỗng
            filter.user = user._id;
        }

        const requests = await DepositRequest.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 });

        res.status(200).json(requests);
    } catch (error) {
        console.error("❌ Lỗi khi lọc yêu cầu:", error);
        res.status(500).json({ message: error.message });
    }
});

// Đặt ở đúng vị trí trong route
router.put('/deposit-requests/reject/:id', async (req, res) => {
    const { id } = req.params;
    await DepositRequest.findByIdAndUpdate(id, { status: 'rejected' });
    res.sendStatus(200);
});

// Lấy lịch sử giao dịch theo userId
router.get('/transactions/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate('wallet');

        if (!user || !user.wallet) {
            return res.status(404).json({ message: 'Không tìm thấy ví người dùng' });
        }

        const transactions = await Transaction.find({ wallet: user.wallet._id }).sort({ createdAt: -1 });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// routes/wallet.js
router.get("/transactions/:walletId/filter", async (req, res) => {
    try {
        const { walletId } = req.params;
        const { type, fromDate, toDate } = req.query;

        const query = { wallet: walletId };

        if (type && type !== 'all') {
            query.type = type;
        }

        if (fromDate && toDate) {
            query.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }

        const transactions = await Transaction.find(query).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /wallet/withdraw/request
router.post('/withdraw/request', async (req, res) => {
    const { userId, amount, bankName, accountName, accountNumber, qrImageBase64 } = req.body;

    try {
        if (!userId || !amount || !bankName || !accountName || !accountNumber) {
            return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
        }

        const user = await User.findById(userId);
        if (!user || !user.wallet) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng hoặc ví' });
        }

        const wallet = await Wallet.findById(user.wallet);
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ message: 'Số dư không đủ' });
        }

        const request = await WithdrawRequest.create({
            user: userId,
            amount,
            bankName,
            accountName,
            accountNumber,
            qrImageBase64: qrImageBase64 || null,
        });

        res.status(201).json({
            message: '✅ Yêu cầu rút tiền đã được gửi',
            request
        });
    } catch (error) {
        console.error('❌ Lỗi rút tiền:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// POST /wallet/withdraw/approve/:id
router.post('/withdraw/approve/:id', async (req, res) => {
    try {
        const request = await WithdrawRequest.findById(req.params.id).populate('user');
        if (!request || request.status !== 'pending') {
            return res.status(400).json({ message: 'Yêu cầu không tồn tại hoặc đã xử lý' });
        }

        const wallet = await Wallet.findById(request.user.wallet);
        if (!wallet || wallet.balance < request.amount) {
            return res.status(400).json({ message: 'Số dư không đủ để rút' });
        }

        // Trừ tiền
        wallet.balance -= request.amount;
        await wallet.save();

        // ✅ Ghi lịch sử giao dịch
        await Transaction.create({
            wallet: wallet._id,
            type: 'withdraw',
            amount: request.amount,
            balanceAfter: wallet.balance,
            description: `Admin duyệt rút tiền về tài khoản: ${request.accountNumber} (${request.bankName})`,
        });

        // ✅ Cập nhật trạng thái
        request.status = 'approved';
        await request.save();

        res.json({ message: '✅ Đã duyệt rút tiền', newBalance: wallet.balance });
    } catch (error) {
        console.error('❌ Lỗi duyệt rút tiền:', error);
        res.status(500).json({ message: error.message });
    }
});

// PUT /wallet/withdraw/reject/:id
router.put('/withdraw/reject/:id', async (req, res) => {
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
        return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối' });
    }

    try {
        const request = await WithdrawRequest.findById(req.params.id);
        if (!request || request.status !== 'pending') {
            return res.status(400).json({ message: 'Yêu cầu không tồn tại hoặc đã xử lý' });
        }

        request.status = 'rejected';
        request.rejectReason = reason;
        await request.save();

        res.json({ message: '✅ Đã từ chối yêu cầu rút tiền' });
    } catch (err) {
        console.error('❌ Lỗi từ chối rút tiền:', err);
        res.status(500).json({ message: err.message });
    }
});


router.get('/withdraw-requests/user/:userId', async (req, res) => {
    try {
        const requests = await WithdrawRequest.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /wallet/withdraw-requests
router.get('/withdraw-requests', async (req, res) => {
    const { email } = req.query;

    try {
        let filter = {};
        if (email) {
            const user = await User.findOne({ email });
            if (user) {
                filter.user = user._id;
            } else {
                return res.json([]);
            }
        }

        const requests = await WithdrawRequest.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        console.error('Lỗi lấy danh sách rút tiền:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
