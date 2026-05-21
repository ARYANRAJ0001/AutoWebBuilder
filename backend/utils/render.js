const axios = require("axios");

async function deployBackendToRender(repoUrl, projectName) {
  try {
    console.log("🚀 Deploying backend to Render...");
    
    if (!process.env.RENDER_API_KEY) {
      console.log("⚠️ RENDER_API_KEY not found. Skipping automatic Render deployment.");
      console.log("📝 Please deploy backend manually at: https://render.com");
      return null;
    }

    const renderApi = axios.create({
      baseURL: "https://api.render.com/v1",
      headers: {
        Authorization: `Bearer ${process.env.RENDER_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    // Create a new Web Service on Render
    const serviceData = {
      name: `${projectName}-backend`,
      repo: repoUrl,
      branch: "main",
      type: "web_service",
      env: "node",
      buildCommand: "cd backend && npm install",
      startCommand: "cd backend && node server.js",
      envVars: [
        {
          key: "PORT",
          value: "5000",
        },
        {
          key: "MONGO_URI",
          value: process.env.MONGO_URI || "mongodb://localhost:27017/app",
        },
      ],
    };

    const response = await renderApi.post("/services", serviceData);
    
    console.log("✅ Backend deployed to Render!");
    return {
      success: true,
      backendUrl: `https://${response.data.service.name}.onrender.com`,
      serviceId: response.data.id,
    };
  } catch (error) {
    console.error("❌ Render deployment failed:", error.response?.data || error.message);
    return null;
  }
}

async function checkRenderDeploymentStatus(serviceId) {
  try {
    const renderApi = axios.create({
      baseURL: "https://api.render.com/v1",
      headers: {
        Authorization: `Bearer ${process.env.RENDER_API_KEY}`,
      },
    });
    
    const response = await renderApi.get(`/services/${serviceId}`);
    return response.data.status;
  } catch (error) {
    return "unknown";
  }
}

module.exports = { deployBackendToRender, checkRenderDeploymentStatus };