const express = require("express");
const router = express.Router();
const logController = require("../controllers/logController");
const { verifyAuth, requireAdmin } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.all("*", verifyAuth);

router.get("/", logController.getLogs);
router.get("/:id", logController.getLogById);
router.post("/", logController.createLog);

module.exports = router;
