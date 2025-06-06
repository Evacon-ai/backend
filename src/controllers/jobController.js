const { db, admin } = require("../config/firebase");
const { publishMessage } = require("../middleware/pubsub");
const { broadcastToOrganization } = require("../server");

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

const getOrganizationJobs = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status } = req.query;

    let query = db
      .collection("jobs")
      .where("organization_id", "==", organizationId);

    if (status) {
      query = query.where("status", "==", status);
    }

    const jobsSnapshot = await query.get();

    const jobs = [];
    jobsSnapshot.forEach((doc) => {
      jobs.push({ id: doc.id, ...doc.data() });
    });

    res.json(jobs);
  } catch (error) {
    console.error("Error getting organization jobs:", error);
    res.status(500).json({ error: "Failed to retrieve organization jobs" });
  }
};

const createJob = async (req, res) => {
  try {
    const { type, payload, organization_id } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Job type is required" });
    }

    if (!organization_id) {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const newJob = {
      status: "pending",
      type,
      payload,
      organization_id,
      result: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
    };

    const docRef = await db.collection("jobs").add(newJob);
    const jobDoc = await docRef.get();

    res.status(201).json({ id: jobDoc.id, ...jobDoc.data() });
    publishMessage("job-created", { id: jobDoc.id, type: type });

    // Temporary: Simulate job completion after 5 seconds
    setTimeout(async () => {
      try {
        // Update the job status to completed
        await db.collection("jobs").doc(jobDoc.id).update({
          status: "completed",
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_by: req.user.uid,
        });

        // Get the updated job data
        const updatedDoc = await db.collection("jobs").doc(jobDoc.id).get();
        const updatedJob = { id: updatedDoc.id, ...updatedDoc.data() };

        // Broadcast the update via WebSocket
        console.log("[TESTING]: before broadcastToOrganization");
        broadcastToOrganization(organization_id, {
          type: "job_update",
          job: updatedJob,
        });
      } catch (error) {
        console.error("Error in job completion simulation:", error);
      }
    }, 5000);
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
    const updatedJob = { id: updatedDoc.id, ...updatedDoc.data() };

    // Broadcast the update to the organization's WebSocket clients
    if (updatedJob.organization_id) {
      broadcastToOrganization(updatedJob.organization_id, {
        type: "job_update",
        job: updatedJob,
      });
    }

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
  getOrganizationJobs,
};
