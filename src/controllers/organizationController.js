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

const createOrganization = async (req, res) => {
  try {
    const { name, website, time_zone, contact, logo_url, notes } = req.body;

    if (!name || !contact?.email || !contact?.name) {
      return res
        .status(400)
        .json({ error: "Organization name and contact details are required" });
    }

    const newOrg = {
      name,
      website: website || "",
      time_zone: time_zone || "America/Los_Angeles",
      contact: {
        ...contact,
      },
      logo_url: logo_url || "",
      notes: notes || "",
      account_status: "active",
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
      name,
      website,
      time_zone,
      contact,
      logo_url,
      notes,
      account_status,
    } = req.body;

    const orgDoc = await db.collection("organizations").doc(id).get();

    if (!orgDoc.exists) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const updates = {
      ...(name && { name }),
      ...(website && { website }),
      ...(time_zone && { time_zone }),
      ...(contact && { contact }),
      ...(logo_url && { logo_url }),
      ...(notes && { notes }),
      ...(account_status && { account_status }),
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
  createOrganization,
  updateOrganization,
  deleteOrganization,
};
