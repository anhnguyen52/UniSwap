const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/CategoryController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.post("/create", categoryController.createCategory);
router.get("/getAllCategories", categoryController.getAllCategories);
router.get("/getCategoryById/:id", categoryController.getCategoryById);
router.put(
  "/updateCategory/:id",

  categoryController.updateCategory
);
router.delete(
  "/deleteCategory/:id",

  categoryController.deleteCategory
);

module.exports = router;
