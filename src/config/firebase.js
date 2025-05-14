const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

require("dotenv").config();

var serviceAccount;
if (process.env.FB_SECRET) serviceAccount = JSON.parse(process.env.FB_SECRET);
else serviceAccount = require("./secret/serviceAccountKey.json");

// Initialize Firebase Admin with specific settings for better reliability
initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Add connection settings for better reliability
  firestore: {
    timestampsInSnapshots: true,
    ignoreUndefinedProperties: true,
    preferRest: true,
  },
  storageBucket: "evacon-ai-565c5.firebasestorage.app",
});

const db = getFirestore("evacon-db");
const bucket = admin.storage().bucket();

// Maximum number of connection attempts
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Helper function to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Test the connection with retries
async function testConnection(retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use a simple query to test connection
      await db.collection("users").limit(1).get();
      console.log("🔥 Firebase connection established successfully");
      return true;
    } catch (error) {
      console.error(
        `❌ Firebase connection attempt ${attempt}/${retries} failed:`,
        error.message
      );

      if (attempt === retries) {
        console.error("❌ Maximum connection attempts reached");
        return false;
      }

      // Wait before retrying
      await delay(RETRY_DELAY);
    }
  }
  return false;
}

// Initialize connection settings
db.settings({
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true,
});

module.exports = {
  admin,
  db,
  bucket,
  testConnection,
};
