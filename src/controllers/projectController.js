const { db, admin } = require("../config/firebase");

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

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
