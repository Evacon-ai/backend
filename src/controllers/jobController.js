const { db, admin } = require("../config/firebase");
const wsService = require("../services/websocketService");
const { enqueueJob } = require("../services/cloudTasksService");

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
    const jobId = jobDoc.id;

    res.status(201).json({ id: jobDoc.id, ...jobDoc.data() });

    // Process job based on type
    let queuePayload = payload;
    console.log("[DEBUG] payload: ", payload);
    console.log("[DEBUG] type: ", type);
    switch (type) {
      case "diagram_elements_extraction":
        try {
          // Extract project_id and diagram_id from payload
          const { project_id, diagram_id } = payload;

          if (!project_id || !diagram_id) {
            throw new Error(
              "project_id and diagram_id are required for diagram_elements_extraction jobs"
            );
          }

          // Get the diagram document to extract preview_url
          const diagramDoc = await db
            .collection("projects")
            .doc(project_id)
            .collection("diagrams")
            .doc(diagram_id)
            .get();

          if (!diagramDoc.exists) {
            throw new Error("Diagram not found");
          }

          const diagramData = diagramDoc.data();

          if (!diagramData.preview_url) {
            throw new Error("Diagram preview URL not found");
          }

          // Build queue payload with preview_url
          queuePayload = {
            preview_url: diagramData.preview_url,
          };

          console.log(
            `[Job ${jobId}] Extracted preview URL for diagram extraction:`,
            diagramData.preview_url
          );
        } catch (error) {
          console.error(
            `[Job ${jobId}] Error preparing diagram extraction job:`,
            error.message
          );

          // Update job status to failed
          await db.collection("jobs").doc(jobId).update({
            status: "failed",
            error: error.message,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Broadcast the failure
          const failedJob = {
            id: jobId,
            ...newJob,
            status: "failed",
            error: error.message,
          };
          wsService.broadcastToOrganization(organization_id, {
            type: "job_update",
            job: failedJob,
          });

          return; // Don't enqueue the job
        }
        break;

      default:
        // For other job types, use the original payload
        console.log(
          `[Job ${jobId}] Using original payload for job type: ${type}`
        );
        break;
    }

    // Enqueue the job with the processed payload
    try {
      const callbackUrl = `${process.env.BACKEND_URL}/jobs/callback`;
      await enqueueJob({
        jobId,
        jobType: type,
        payload: queuePayload,
        callbackUrl,
      });
      console.log(`[Job ${jobId}] Successfully enqueued job of type: ${type}`);
    } catch (err) {
      console.warn(`[Job ${jobId}] Job queueing failed:`, err.message);

      // Update job status to indicate queueing failure
      await db
        .collection("jobs")
        .doc(jobId)
        .update({
          status: "failed",
          error: `Failed to enqueue job: ${err.message}`,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Broadcast the failure
      const failedJob = {
        id: jobId,
        ...newJob,
        status: "failed",
        error: `Failed to enqueue job: ${err.message}`,
      };
      wsService.broadcastToOrganization(organization_id, {
        type: "job_update",
        job: failedJob,
      });
    }
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
      wsService.broadcastToOrganization(updatedJob.organization_id, {
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

const jobCallback = async (req, res) => {
  try {
    const { jobId, status, result, error } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    // Validate status
    const validStatuses = [
      "pending",
      "processing",
      "completed",
      "failed",
      "aborted",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Get the job document
    const jobDoc = await db.collection("jobs").doc(jobId).get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const jobData = jobDoc.data();

    // Prepare updates
    const updates = {
      status,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add result if job is completed successfully
    if (status === "completed" && result !== undefined) {
      updates.result = result;
    }

    // Add error if job failed
    if (status === "failed" && error !== undefined) {
      updates.error = error;
    }

    // Handle job-specific logic based on job type and status
    switch (jobData.type) {
      case "diagram_elements_extraction":
        if (status === "completed" && result) {
          try {
            // Extract project_id and diagram_id from the original payload
            const { project_id, diagram_id } = jobData.payload;

            if (project_id && diagram_id) {
              // Update the diagram document with extracted elements
              await db
                .collection("projects")
                .doc(project_id)
                .collection("diagrams")
                .doc(diagram_id)
                .update({
                  elements: result.elements || [],
                  extraction_completed_at:
                    admin.firestore.FieldValue.serverTimestamp(),
                  extraction_metadata: result.metadata || {},
                });

              console.log(
                `[Job ${jobId}] Updated diagram ${diagram_id} with extracted elements`
              );
            }
          } catch (diagramUpdateError) {
            console.error(
              `[Job ${jobId}] Failed to update diagram with extracted elements:`,
              diagramUpdateError
            );
            // Don't fail the job callback, just log the error
          }
        }
        break;
      default:
        // For unknown job types, just log
        console.log(
          `[Job ${jobId}] Job type '${jobData.type}' completed - no specific handling required`
        );
        break;
    }

    // Update the job in the database
    await db.collection("jobs").doc(jobId).update(updates);

    // Get the updated job data
    const updatedDoc = await db.collection("jobs").doc(jobId).get();
    const updatedJob = { id: updatedDoc.id, ...updatedDoc.data() };

    // Broadcast the update to the organization's WebSocket clients
    if (jobData.organization_id) {
      wsService.broadcastToOrganization(jobData.organization_id, {
        type: "job_update",
        job: updatedJob,
      });
    }

    // Log the job status change
    console.log(`Job ${jobId} status updated to: ${status}`);
    if (status === "completed") {
      console.log(`Job ${jobId} completed successfully`);
    } else if (status === "failed") {
      console.log(`Job ${jobId} failed:`, error);
    }

    res.json({
      message: "Job status updated successfully",
      job: updatedJob,
    });
  } catch (error) {
    console.error("Error in job callback:", error);
    res.status(500).json({ error: "Failed to update job status" });
  }
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getOrganizationJobs,
  jobCallback,
};
