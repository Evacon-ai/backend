const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyAuth, requireAdmin } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.all("*", verifyAuth);

// Routes that any authenticated user can access
router.get("/me", userController.getCurrentUser);

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
