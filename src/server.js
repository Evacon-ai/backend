const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const { testConnection } = require("./config/firebase");
const userRoutes = require("./routes/userRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const projectRoutes = require("./routes/projectRoutes");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan("dev")); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(
  "/pdf-viewer/web",
  express.static(path.join(__dirname, "../public/pdf-viewer/web"))
);
app.use(
  "/pdf-viewer/build",
  express.static(path.join(__dirname, "../public/pdf-viewer/build"))
);

// Health check endpoint with detailed status
app.get("/health", async (req, res) => {
  const firebaseStatus = await testConnection(1); // Use 1 retry for health checks to be responsive
  res.json({
    status: firebaseStatus ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      api: "🟢 Running",
      firebase: firebaseStatus ? "🟢 Connected" : "🔴 Disconnected",
    },
  });
});

// Mount user routes
app.use("/api/users", userRoutes);
// Mount organization routes
app.use("/api/organizations", organizationRoutes);
// Mount project routes
app.use("/api/projects", projectRoutes);

// API routes will be mounted here
app.use("/api", (req, res) => {
  res.json({ message: "Welcome to Evacon Console API" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// PDF proxy endpoint
// This endpoint fetches a PDF from a given URL and streams it to the client
// It sets the appropriate headers for PDF content and caching
// It also handles errors and logs them to the console
// This is useful for serving PDFs from external sources without exposing the URL directly

const fetch = require("node-fetch");

app.get("/pdf-proxy", async (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl) return res.status(400).send("Missing URL");

  try {
    const response = await fetch(fileUrl);
    console.log("[PDF Proxy] Fetching:", fileUrl);
    console.log("[PDF Proxy] Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[PDF Proxy] Upstream response body:", errorText);
      return res
        .status(response.status)
        .send(`Upstream error (${response.status})`);
    }

    res.set({
      "Content-Type": response.headers.get("content-type") || "application/pdf",
      "Cache-Control": "private, max-age=300",
    });

    response.body.pipe(res);
  } catch (err) {
    console.error("PDF proxy failed:", err);
    res.status(500).send("Failed to fetch PDF");
  }
});

app.get("/puppet-test", async (req, res) => {
  const puppeteer = require("puppeteer");
  const path = puppeteer.executablePath();
  res.send("Using Chrome from: " + path);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Start server and initialize Firebase connection
const startServer = async () => {
  // Test Firebase connection before starting the server
  const firebaseStatus = await testConnection();
  if (!firebaseStatus) {
    console.warn(
      "⚠️ Warning: Server starting with degraded Firebase connectivity"
    );
  }

  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📊 Health check available at http://localhost:${port}/health`);
  });
};

startServer();
