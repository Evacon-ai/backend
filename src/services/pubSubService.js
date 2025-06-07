const { PubSub } = require("@google-cloud/pubsub");

// Initialize the Pub/Sub client
const pubSubClient = new PubSub();

async function publishMessage(topicName, json) {
  const data = JSON.stringify(json);
  const dataBuffer = Buffer.from(data);

  try {
    const messageId = await pubSubClient
      .topic(topicName)
      .publishMessage({ data: dataBuffer });
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Error publishing message: ${error}`);
  }
}

module.exports = { publishMessage };
