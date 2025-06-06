const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");
const { verifyAuth, requireAdmin } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.all("*", verifyAuth);

// Routes that require admin access
router.get("/", jobController.getAllJobs);
router.get("/:id", jobController.getJobById);
router.get("/organization/:organizationId", jobController.getOrganizationJobs);
router.post("/", jobController.createJob);
router.put("/:id", jobController.updateJob);
router.delete("/:id", jobController.deleteJob);

module.exports = router;
