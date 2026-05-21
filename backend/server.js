const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "https://*.netlify.app"],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Import routes
const authRoutes = require("./routes/authRoutes");
const generateRoutes = require("./routes/generateRoutes");
const deployRoutes = require("./routes/deployRoutes");
const projectRoutes = require("./routes/projectRoutes");
const fullStackRoutes = require("./routes/fullStackRoutes");

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api", generateRoutes);
app.use("/api", deployRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/fullstack", fullStackRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    routes: {
      auth: "POST /api/auth/signup, POST /api/auth/login",
      generate: "POST /api/generate",
      deploy: "POST /api/deploy",
      projects: "GET /api/projects",
      fullstack: "POST /api/fullstack/generate, POST /api/fullstack/deploy, POST /api/fullstack/generate-deploy"
    }
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: [
      "POST /api/auth/signup",
      "POST /api/auth/login",
      "POST /api/generate",
      "POST /api/deploy",
      "GET /api/projects",
      "POST /api/fullstack/generate",
      "POST /api/fullstack/deploy",
      "POST /api/fullstack/generate-deploy",
      "GET /api/health"
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

// Start server
const PORT = process.env.PORT || 1256;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log("\n📋 Available endpoints:");
      console.log("   POST   /api/auth/signup");
      console.log("   POST   /api/auth/login");
      console.log("   POST   /api/generate");
      console.log("   POST   /api/deploy");
      console.log("   GET    /api/projects");
      console.log("   POST   /api/fullstack/generate");
      console.log("   POST   /api/fullstack/deploy");
      console.log("   POST   /api/fullstack/generate-deploy");
      console.log("   GET    /api/health\n");
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    app.listen(PORT, () => {
      console.log(`\n⚠️ Server running without MongoDB on port ${PORT}\n`);
    });
  });