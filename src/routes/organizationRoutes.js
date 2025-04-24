const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const { verifyAuth, requireAdmin } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.all("*", verifyAuth);

// Routes that require admin access
router.get("/", organizationController.getAllOrganizations);
router.get("/:id", organizationController.getOrganizationById);
router.post("/", organizationController.createOrganization);
router.put("/:id", organizationController.updateOrganization);
router.delete("/:id", organizationController.deleteOrganization);

module.exports = router;
