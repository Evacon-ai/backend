const { db, admin } = require("../config/firebase");

const getAllOrganizations = async (req, res) => {
  try {
    const orgsSnapshot = await db.collection("organizations").get();
    const organizations = [];
    orgsSnapshot.forEach((doc) => {
      organizations.push({ id: doc.id, ...doc.data() });
    });
    res.json(organizations);
  } catch (error) {
    console.error("Error getting organizations:", error);
    res.status(500).json({ error: "Failed to retrieve organizations" });
  }
};

const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgDoc = await db.collection("organizations").doc(id).get();

    if (!orgDoc.exists) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({ id: orgDoc.id, ...orgDoc.data() });
  } catch (error) {
    console.error("Error getting organization:", error);
    res.status(500).json({ error: "Failed to retrieve organization" });
  }
};

const getOrganizationProjects = async (req, res) => {
  try {
    const { id } = req.params;

    // First check if organization exists
    const orgDoc = await db.collection("organizations").doc(id).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get all projects for this organization
    const projectsSnapshot = await db
      .collection("projects")
      .where("organization_id", "==", id)
      .get();

    const projects = [];
    projectsSnapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });

    res.json(projects);
  } catch (error) {
    console.error("Error getting organization projects:", error);
    res.status(500).json({ error: "Failed to retrieve organization projects" });
  }
};

const createOrganization = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Organization name is required" });
    }

    const newOrg = {
      account_status: "active",
      address: {
        city: "",
        country: "",
        postal_code: "",
        state: "",
        street: "",
      },
      contact: {
        email: "",
        name: "",
        phone: "",
      },
      logo_url: "",
      name,
      notes: "",
      time_zone: "America/Los_Angeles",
      website: "",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
    };

    const docRef = await db.collection("organizations").add(newOrg);
    const orgDoc = await docRef.get();

    res.status(201).json({ id: orgDoc.id, ...orgDoc.data() });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ error: "Failed to create organization" });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      account_status,
      address,
      contact,
      logo_url,
      name,
      notes,
      time_zone,
      website,
    } = req.body;

    const orgDoc = await db.collection("organizations").doc(id).get();

    if (!orgDoc.exists) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const updates = {
      ...(account_status !== undefined && { account_status }),
      ...(address !== undefined && { address }),
      ...(contact !== undefined && { contact }),
      ...(logo_url !== undefined && { logo_url }),
      ...(name !== undefined && { name }),
      ...(notes !== undefined && { notes }),
      ...(time_zone !== undefined && { time_zone }),
      ...(website !== undefined && { website }),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: req.user.uid,
    };

    await db.collection("organizations").doc(id).update(updates);

    const updatedDoc = await db.collection("organizations").doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({ error: "Failed to update organization" });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    const orgDoc = await db.collection("organizations").doc(id).get();

    if (!orgDoc.exists) {
      return res.status(404).json({ error: "Organization not found" });
    }

    await db.collection("organizations").doc(id).delete();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting organization:", error);
    res.status(500).json({ error: "Failed to delete organization" });
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  getOrganizationProjects,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};
