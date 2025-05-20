const { db, admin } = require("../config/firebase");
const { publishMessage } = require("../middleware/pubsub");

const getAllJobs = async (req, res) => {
  try {
    const jobsSnapshot = await db.collection("jobs").get();
    const jobs = [];
    jobsSnapshot.forEach((doc) => {
      jobs.push({ id: doc.id, ...doc.data() });
    });
    res.json(jobs);
  } catch (error) {
    console.error("Error getting jobs:", error);
    res.status(500).json({ error: "Failed to retrieve jobs" });
  }
};

const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const jobDoc = await db.collection("jobs").doc(id).get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({ id: jobDoc.id, ...jobDoc.data() });
  } catch (error) {
    console.error("Error getting job:", error);
    res.status(500).json({ error: "Failed to retrieve job" });
  }
};

const createJob = async (req, res) => {
  try {
    const { type, payload } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Job type is required" });
    }

    const newJob = {
      status: "pending",
      type,
      payload,
      result: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
    };

    const docRef = await db.collection("jobs").add(newJob);
    const jobDoc = await docRef.get();

    res.status(201).json({ id: jobDoc.id, ...jobDoc.data() });
    publishMessage("job-created", { id: jobDoc.id, type: type });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
};

const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, type, payload, result } = req.body;

    const jobDoc = await db.collection("jobs").doc(id).get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const updates = {
      ...(status !== undefined && { status }),
      ...(type !== undefined && { type }),
      ...(payload !== undefined && { payload }),
      ...(result !== undefined && { result }),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: req.user.uid,
    };

    await db.collection("jobs").doc(id).update(updates);

    const updatedDoc = await db.collection("jobs").doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ error: "Failed to update job" });
  }
};

const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const jobDoc = await db.collection("jobs").doc(id).get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    await db.collection("jobs").doc(id).delete();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: "Failed to delete job" });
  }
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
};
