const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const { authMiddleware, authUserMiddleware } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

/**
 * @swagger
 * /api/user/sign-up:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     description: Tạo một tài khoản mới với email và mật khẩu.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Nguyen Van A"
 *               email:
 *                 type: string
 *                 example: "test@gmail.com"
 *               password:
 *                 type: string
 *                 example: "123456"
 *               confirmPassword:
 *                 type: string
 *                 example: "123456"
 *               phone:
 *                 type: string
 *                 example: "0123456789"
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post("/sign-up", userController.createUser);

/**
 * @swagger
 * /api/user/sign-in:
 *   post:
 *     summary: Đăng nhập người dùng
 *     description: Đăng nhập với email và mật khẩu.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "test@gmail.com"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Sai email hoặc mật khẩu
 */
router.post("/sign-in", userController.loginUser);
router.post("/log-out", userController.logoutUser);
router.put("/update-user/:id", authUserMiddleware, userController.updateUser);
router.get("/getAll", authMiddleware, userController.getAllUsers);
router.delete("/delete-user/:id", authMiddleware, userController.deleteUser);
router.get('/get-details/:id', authUserMiddleware, userController.getDetailsUser);
router.post('/refresh-token', userController.refreshToken);
router.post("/delete-many/", authMiddleware, userController.deleteMany);
router.post('/upload-avatar', upload.single('avatar'), userController.uploadAvatar);



module.exports = router;
