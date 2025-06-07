const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

async function enqueueJob({ jobId, jobType, payload }) {
  const project = "evacon-ai";
  const location = "us-west1";
  const queue = "diagram-jobs";
  const serviceUrl = "https://job-runner-abc123.a.run.app/process-job";

  const parent = client.queuePath(project, location, queue);

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: serviceUrl,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify({ jobId, jobType, payload })).toString(
        "base64"
      ),
      oidcToken: {
        serviceAccountEmail: "task-invoker@evacon-ai.iam.gserviceaccount.com",
      },
    },
  };

  const [response] = await client.createTask({ parent, task });
  console.log(`Task created: ${response.name}`);
}

module.exports = { enqueueJob };
