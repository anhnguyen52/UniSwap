const express = require("express");
const router = express.Router();
const dotenv = require('dotenv');
const User = require("../models/UserModel");
const PaymentRequest = require("../models/PaymentRequestModel");
const Post = require("../models/PostModel");
const Transaction = require("../models/TransactionModel");
const Wallet = require("../models/WalletModel");

router.get("/config", (req, res) => {
  return res.status(200).json({
    status: 'OK',
    data: process.env.CLIENT_ID
  });
});

router.get("/detailRequest/:id", async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id.toString())
      .populate("postId")
      .populate({
        path: "userId",
        select: "-avatar -password"
      });

    if (!paymentRequest) {
      return res.status(404).json({ message: 'Payment request not found' });
    }
    return res.status(200).json(paymentRequest);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
})

router.post("/pay", async (req, res) => {
  const { paymentRequestId, userId } = req.body;

  try {
    const paymentRequest = await PaymentRequest.findById(paymentRequestId);
    if (!paymentRequest || paymentRequest.userId.toString() !== userId) {
      return res.status(404).json({ message: 'Payment request not found or unauthorized' });
    }

    if (paymentRequest.isPaid) {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    const amount = paymentRequest.amount;

    const user = await User.findById(userId).populate("wallet");
    if (user.wallet.balance < amount) {
      return res.status(400).json({ success: false, error: 'INSUFFICIENT_FUNDS' });
    }

    user.wallet.balance -= amount;
    await user.wallet.save();

    // ✅ Ghi lịch sử giao dịch
    await Transaction.create({
      wallet: user.wallet._id,
      type: 'purchase',
      amount: amount,
      balanceAfter: user.wallet.balance,
      description: 'Phí đăng bài'
    });

    paymentRequest.isPaid = true;
    paymentRequest.paidAt = new Date();
    await paymentRequest.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
