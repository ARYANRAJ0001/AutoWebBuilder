const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 1256;

/**
 * CORS FIX
 * Add your deployed frontend URL here.
 * Backend:  https://autowebbuilder.onrender.com
 * Frontend: https://autowebbuilder-1.onrender.com
 */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://autowebbuilder-1.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow Postman, curl, server-to-server requests
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow Netlify frontend URLs
      if (/^https:\/\/[a-zA-Z0-9-]+\.netlify\.app$/.test(origin)) {
        return callback(null, true);
      }

      // Allow Render frontend URLs
      if (/^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Prompt2Site backend is running",
    health: "/api/health",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    mongo:
      mongoose.connection.readyState === 1
        ? "connected"
        : "not connected",
    routes: {
      auth: "POST /api/auth/signup, POST /api/auth/login",
      generate: "POST /api/generate",
      deploy: "POST /api/deploy",
      projects: "GET /api/projects",
      fullstack:
        "POST /api/fullstack/generate, POST /api/fullstack/deploy, POST /api/fullstack/generate-deploy",
    },
  });
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

// 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      "GET /",
      "GET /api/health",
      "POST /api/auth/signup",
      "POST /api/auth/login",
      "POST /api/generate",
      "POST /api/deploy",
      "GET /api/projects",
      "POST /api/fullstack/generate",
      "POST /api/fullstack/deploy",
      "POST /api/fullstack/generate-deploy",
    ],
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

function startServer() {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log("\n📋 Available endpoints:");
    console.log("   GET    /");
    console.log("   GET    /api/health");
    console.log("   POST   /api/auth/signup");
    console.log("   POST   /api/auth/login");
    console.log("   POST   /api/generate");
    console.log("   POST   /api/deploy");
    console.log("   GET    /api/projects");
    console.log("   POST   /api/fullstack/generate");
    console.log("   POST   /api/fullstack/deploy");
    console.log("   POST   /api/fullstack/generate-deploy\n");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
      console.error(`Run this command on Mac:`);
      console.error(`lsof -ti:${PORT} | xargs kill -9`);
      process.exit(1);
    }

    console.error("❌ Server listen error:", err);
    process.exit(1);
  });
}

async function connectMongoAndStart() {
  try {
    if (!process.env.MONGO_URI) {
      console.log("⚠️ MONGO_URI missing. Server will run without MongoDB.");
      startServer();
      return;
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected successfully");
    startServer();
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("⚠️ Server will still start without MongoDB.");
    startServer();
  }
}

connectMongoAndStart();
