const axios = require("../utils/axios");

async function extractElementsFromDiagram(diagramUrl) {
  if (!diagramUrl) {
    throw new Error("Missing diagram URL");
  }

  try {
    const response = await axios.post(
      "https://evacon-extractor-754396764509.us-central1.run.app/extract_ic",
      { url: diagramUrl },
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

module.exports = { extractElementsFromDiagram };
