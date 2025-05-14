const { db, admin } = require("../config/firebase");
const { extractElementsFromDiagram } = require("../services/diagramExtractor");

const getAllProjects = async (req, res) => {
  try {
    const projectsSnapshot = await db.collection("projects").get();
    const projects = [];
    projectsSnapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });
    res.json(projects);
  } catch (error) {
    console.error("Error getting projects:", error);
    res.status(500).json({ error: "Failed to retrieve projects" });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const projectDoc = await db.collection("projects").doc(id).get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ id: projectDoc.id, ...projectDoc.data() });
  } catch (error) {
    console.error("Error getting project:", error);
    res.status(500).json({ error: "Failed to retrieve project" });
  }
};

const createProject = async (req, res) => {
  try {
    const { description, location, name, organization_id, status } = req.body;

    if (!name || !organization_id) {
      return res
        .status(400)
        .json({ error: "Project name and organization_id are required" });
    }

    const newProject = {
      description: description || "",
      location: location || {
        city: "",
        state: "",
        country: "",
      },
      name,
      organization_id,
      status: status || "active",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
    };

    const docRef = await db.collection("projects").add(newProject);
    const projectDoc = await docRef.get();

    res.status(201).json({ id: projectDoc.id, ...projectDoc.data() });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, location, name, organization_id, status } = req.body;

    const projectDoc = await db.collection("projects").doc(id).get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const updates = {
      ...(description !== undefined && { description }),
      ...(location !== undefined && { location }),
      ...(name !== undefined && { name }),
      ...(organization_id !== undefined && { organization_id }),
      ...(status !== undefined && { status }),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: req.user.uid,
    };

    await db.collection("projects").doc(id).update(updates);

    const updatedDoc = await db.collection("projects").doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const projectDoc = await db.collection("projects").doc(id).get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    await db.collection("projects").doc(id).delete();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
};

// Diagram operations
const getAllDiagrams = async (req, res) => {
  try {
    const { projectId } = req.params;
    const diagramsSnapshot = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .get();

    if (!diagramsSnapshot.empty) {
      const diagrams = [];
      diagramsSnapshot.forEach((doc) => {
        diagrams.push({ id: doc.id, ...doc.data() });
      });
      res.json(diagrams);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error("Error getting diagrams:", error);
    res.status(500).json({ error: "Failed to retrieve diagrams" });
  }
};

const getDiagramById = async (req, res) => {
  try {
    const { projectId, diagramId } = req.params;
    const diagramDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .get();

    if (!diagramDoc.exists) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    res.json({ id: diagramDoc.id, ...diagramDoc.data() });
  } catch (error) {
    console.error("Error getting diagram:", error);
    res.status(500).json({ error: "Failed to retrieve diagram" });
  }
};

const createDiagram = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, url, elements } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Diagram name is required" });
    }

    const newDiagram = {
      name,
      description: description || "",
      url: url || "",
      elements: elements || [],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
    };

    const docRef = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .add(newDiagram);
    const diagramDoc = await docRef.get();

    res.status(201).json({ id: diagramDoc.id, ...diagramDoc.data() });
  } catch (error) {
    console.error("Error creating diagram:", error);
    res.status(500).json({ error: "Failed to create diagram" });
  }
};

const updateDiagram = async (req, res) => {
  try {
    const { projectId, diagramId } = req.params;
    const { name, description, url, elements } = req.body;

    const diagramDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .get();

    if (!diagramDoc.exists) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    const updates = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(url !== undefined && { url }),
      ...(elements !== undefined && { elements }),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: req.user.uid,
    };

    await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .update(updates);

    const updatedDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating diagram:", error);
    res.status(500).json({ error: "Failed to update diagram" });
  }
};

const deleteDiagram = async (req, res) => {
  try {
    const { projectId, diagramId } = req.params;

    const diagramDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .get();

    if (!diagramDoc.exists) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .delete();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting diagram:", error);
    res.status(500).json({ error: "Failed to delete diagram" });
  }
};

const getDiagramDataExtract = async (req, res) => {
  try {
    const { projectId, diagramId } = req.params;
    const diagramDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("diagrams")
      .doc(diagramId)
      .get();

    if (!diagramDoc.exists) {
      return res.status(404).json({ error: "Diagram not found" });
    }
    const diagramData = diagramDoc.data();

    try {
      // Make request to AI API

      if (!diagramData?.url) {
        return res.status(400).json({ error: "Missing diagram URL" });
      }

      const response = await extractElementsFromDiagram(diagramData.url);
      const elements = response || [];

      // Save received extracted data in DB
      const updates = {
        ...(elements !== undefined && { elements }),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: req.user.uid,
      };

      await db
        .collection("projects")
        .doc(projectId)
        .collection("diagrams")
        .doc(diagramId)
        .update(updates);
      const updatedDoc = await db
        .collection("projects")
        .doc(projectId)
        .collection("diagrams")
        .doc(diagramId)
        .get();

      // Send responce back (full diagram object)
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
      console.error("Error processing diagram with AI:", error);
      res.status(500).json({ error: "Failed to process diagram with AI" });
    }
  } catch (error) {
    console.error("Error getting diagram:", error);
    res.status(500).json({ error: "Failed to retrieve diagram" });
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllDiagrams,
  getDiagramById,
  createDiagram,
  updateDiagram,
  deleteDiagram,
  getDiagramDataExtract,
};
