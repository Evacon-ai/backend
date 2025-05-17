const axios = require("../utils/axios");
const { Storage } = require("@google-cloud/storage");

async function extractElementsFromDiagram(diagramUrl) {
  if (!diagramUrl) {
    throw new Error("Missing diagram URL");
  }

  // Generate signed URL for the diagram

  var serviceAccount;
  if (process.env.STORAGE_SECRET)
    serviceAccount = JSON.parse(process.env.STORAGE_SECRET);
  else
    serviceAccount = require("../config/secret/evacon-ai-565c5-d4e3a89d59d4.json");

  const storage = new Storage({
    projectId: "evacon-ai-565c5",
    credentials: serviceAccount,
  });

  const filePath = extractFirebaseStoragePath(diagramUrl);
  console.log("[DEBUG] Extracted URL:", filePath);
  const [url] = await storage
    .bucket("evacon-ai-565c5.appspot.com")
    .file(filePath)
    .getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000, // 15 min
    });

  console.log("Signed URL:", url);

  try {
    const response = await axios.post(
      "https://evacon-extractor-754396764509.us-central1.run.app/extract_ic",
      { url: url },
      { timeout: 10000 }
    );

    return response.data;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      const timeoutError = new Error("Extractor service timed out");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    const genericError = new Error("Failed to extract diagram elements");
    genericError.statusCode = 500;
    throw genericError;
  }
}

function extractFirebaseStoragePath(url) {
  try {
    const match = url.match(/\/o\/(.*?)\?/);
    if (!match || !match[1]) {
      throw new Error("Invalid Firebase Storage URL");
    }
    return decodeURIComponent(match[1]);
  } catch (err) {
    console.error("Failed to extract path:", err.message);
    return null;
  }
}

module.exports = { extractElementsFromDiagram };
