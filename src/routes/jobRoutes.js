const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");
const { verifyAuth, requireAdmin } = require("../middleware/auth");

router.post("/callback", jobController.jobCallback);

// Apply authentication middleware to all following routes
router.all("*", verifyAuth);

// Routes that require admin access
router.get("/", jobController.getAllJobs);
router.get("/:id", jobController.getJobById);
router.get("/organization/:organizationId", jobController.getOrganizationJobs);
router.post("/", jobController.createJob);
router.put("/:id", jobController.updateJob);
router.delete("/:id", jobController.deleteJob);

module.exports = router;
