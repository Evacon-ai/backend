const axios = require("../utils/axios");
const FormData = require("form-data");

async function extractElementsFromDiagram(diagramUrl) {
  if (!diagramUrl) {
    throw new Error("Missing diagram URL");
  }

  console.log("[DEBUG] Extracted URL:", diagramUrl);
  try {
    const apiPath =
      process.env.AI_API_SERVICE_URL ||
      "https://evacon-extractor-754396764509.us-central1.run.app";

    const form = new FormData();
    form.append("url", diagramUrl);
    form.append("gen_ic_list", "true");

    const response = await axios.post(`${apiPath}/extract_ic`, form, {
      timeout: 60000,
      headers: form.getHeaders(), // this sets the correct multipart/form-data headers
    });
    console.log("[DEBUG] response: ", response.data);
    return response.data;
  } catch (error) {
    console.log("[DEBUG] response: ", error);
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
