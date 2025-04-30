const express = require("express");
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
