const express = require("express");
const { check, validationResult } = require("express-validator");
const winston = require("winston");
const NodeCache = require("node-cache");
const Transaction = require("../models/TransactionModel");

const router = express.Router();
const cache = new NodeCache({ stdTTL: 300 }); // Cache 5 phút
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Middleware validation
const validateStatsRequest = [
  check("period")
    .isIn(["all", "day", "week", "month", "year"])
    .withMessage("Giá trị period không hợp lệ"),
  check("date")
    .optional()
    .isISO8601()
    .withMessage("Tham số date phải là định dạng ISO8601"),
  check("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên dương"),
  check("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Giới hạn phải từ 1 đến 100"),
  check("timezone")
    .optional()
    .isString()
    .withMessage("Timezone phải là chuỗi hợp lệ"),
];

router.get("/purchases/stats", validateStatsRequest, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Invalid request parameters", { errors: errors.array() });
    return res.status(400).json({
      success: false,
      message: "Tham số không hợp lệ",
      error: errors.array().map((err) => err.msg).join(", "),
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { period = "all", date, page = 1, limit = 10, timezone = "UTC" } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const cacheKey = `stats_${period}_${date || "no-date"}_${pageNum}_${limitNum}_${timezone}`;

    // Kiểm tra cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      logger.info(`Cache hit for key: ${cacheKey}`, { period, date, page, limit });
      return res.json(cachedData);
    }

    let query = { type: "purchase" };
    const now = new Date();

    // Xử lý khoảng thời gian
    if (period === "day") {
      const startOfDay = date
        ? new Date(new Date(date).toISOString().split("T")[0] + "T00:00:00.000Z")
        : new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z");
      const endOfDay = date
        ? new Date(new Date(date).toISOString().split("T")[0] + "T23:59:59.999Z")
        : new Date(now.toISOString().split("T")[0] + "T23:59:59.999Z");
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else if (period === "week") {
      const day = now.getUTCDay();
      const startOfWeek = new Date(now);
      startOfWeek.setUTCDate(now.getUTCDate() - day);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
      endOfWeek.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (period === "month") {
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const endOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
      );
      query.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (period === "year") {
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const endOfYear = new Date(
        Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999)
      );
      query.createdAt = { $gte: startOfYear, $lte: endOfYear };
    }

    // Tối ưu truy vấn MongoDB
    const [result, transactions, totalCount] = await Promise.all([
      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]),
      Transaction.find(query)
        .select("amount description createdAt")
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(), // Tối ưu bằng lean()
      Transaction.countDocuments(query),
    ]);

    const totalRevenue = result.length > 0 ? result[0].totalRevenue : 0;

    const response = {
      success: true,
      data: {
        totalRevenue,
        totalTransactions: totalCount,
        transactions,
        period,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
      timestamp: new Date().toISOString(),
    };

    // Lưu vào cache
    cache.set(cacheKey, response);
    logger.info(`Cache miss, stored data for key: ${cacheKey}`, {
      period,
      date,
      page,
      limit,
      totalRevenue,
      totalTransactions: totalCount,
    });

    res.json(response);
  } catch (error) {
    logger.error("Error fetching purchase stats", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Lỗi khi tính tổng doanh thu từ purchase",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;