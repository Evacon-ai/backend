const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { verifyAuth, requireAdmin } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.all("*", verifyAuth);

// Routes that require admin access
router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);
router.post("/", projectController.createProject);
router.put("/:id", projectController.updateProject);
router.delete("/:id", projectController.deleteProject);

// Diagram routes
router.get("/:projectId/diagrams", projectController.getAllDiagrams);
router.get("/:projectId/diagrams/:diagramId", projectController.getDiagramById);
router.post("/:projectId/diagrams", projectController.createDiagram);
router.put("/:projectId/diagrams/:diagramId", projectController.updateDiagram);
router.delete(
  "/:projectId/diagrams/:diagramId",
  projectController.deleteDiagram
);

router.get(
  "/:projectId/diagrams/:diagramId",
  projectController.getDiagramDataExtract
);

module.exports = router;
