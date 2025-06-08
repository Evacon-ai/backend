const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

async function enqueueJob({ jobId, jobType, payload, callbackUrl }) {
  console.log("[DEBUG] enqueueJob launched");
  const project = "evacon-ai";
  const location = "us-central1";
  const queue = "diagram-jobs";
  const serviceUrl = `${process.env.TASK_WORKER_URL}/process-job`;
  console.log("[DEBUG] service URL: ", serviceUrl);
  const parent = client.queuePath(project, location, queue);

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: serviceUrl,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(
        JSON.stringify({ jobId, jobType, payload, callbackUrl })
      ).toString("base64"),
      oidcToken: {
        serviceAccountEmail: process.env.TASK_WORKER_SERVICE_ACCOUNT_EMAIL,
      },
    },
  };
  console.log("[DEBUG] task: ", task);
  const [response] = await client.createTask({ parent, task });
  console.log(`[DEBUG] Task created: ${response.name}`);
}

module.exports = { enqueueJob };
