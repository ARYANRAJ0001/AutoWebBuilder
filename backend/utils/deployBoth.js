const axios = require("axios");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

/**
 * Clean project/service/site name
 */
function cleanName(name) {
  return (
    String(name || "fullstack-app")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "fullstack-app"
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileSafe(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content || "", "utf8");
}

/**
 * Make sure frontend package.json has correct Vite scripts/dependencies
 */
function normalizeFrontendPackageJson(pkg, projectName) {
  let parsed;

  try {
    parsed = typeof pkg === "string" ? JSON.parse(pkg) : pkg;
  } catch {
    parsed = {};
  }

  parsed.name = cleanName(parsed.name || projectName || "generated-frontend");
  parsed.version = parsed.version || "1.0.0";
  parsed.private = true;
  parsed.type = "module";

  parsed.scripts = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    ...(parsed.scripts || {}),
  };

  parsed.dependencies = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    axios: "^1.6.0",
    ...(parsed.dependencies || {}),
  };

  parsed.devDependencies = {
    "@vitejs/plugin-react": "^4.2.1",
    vite: "^5.0.0",
    ...(parsed.devDependencies || {}),
  };

  return JSON.stringify(parsed, null, 2);
}

/**
 * Collect frontend files from generated code
 */
function getFrontendFiles(code, projectName, backendUrl) {
  const f = code.frontend || {};

  const indexHtml =
    f.indexHtml ||
    f["index.html"] ||
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

  const packageJson = normalizeFrontendPackageJson(
    f.packageJson || f["package.json"],
    projectName
  );

  const viteConfig =
    f.viteConfig ||
    f["vite.config.js"] ||
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`;

  const mainJsx =
    f.mainJsx ||
    f["src/main.jsx"] ||
    `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

  let appJsx =
    f.appJsx ||
    f["src/App.jsx"] ||
    `import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [message, setMessage] = useState("Loading backend...");

  useEffect(() => {
    axios
      .get(\`\${API_URL}/api/health\`)
      .then((res) => {
        setMessage(res.data.message || "Backend connected successfully");
      })
      .catch((err) => {
        console.error(err);
        setMessage("Frontend loaded, but backend API failed");
      });
  }, []);

  return (
    <div className="app">
      <h1>${projectName}</h1>
      <p>{message}</p>
      <p>API URL: {API_URL}</p>
    </div>
  );
}

export default App;`;

  /**
   * Patch common wrong generated URLs.
   * This prevents deployed frontend from calling localhost.
   */
  appJsx = appJsx
    .replace(/http:\/\/localhost:5000/g, "${API_URL}")
    .replace(/http:\/\/localhost:3000/g, "${API_URL}")
    .replace(/http:\/\/localhost:8000/g, "${API_URL}")
    .replace(/http:\/\/127\.0\.0\.1:5000/g, "${API_URL}");

  /**
   * If AI-generated App.jsx does not have API_URL, inject it.
   */
  if (!appJsx.includes("import.meta.env.VITE_API_URL")) {
    appJsx =
      `const API_URL = import.meta.env.VITE_API_URL || "${
        backendUrl || "http://localhost:5000"
      }";\n` + appJsx;
  }

  const appCss =
    f.appCss ||
    f["src/App.css"] ||
    `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, Arial, sans-serif;
  background: #f4f6f8;
}

.app {
  max-width: 900px;
  margin: 60px auto;
  background: white;
  padding: 32px;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

h1 {
  margin-top: 0;
}`;

  return {
    indexHtml,
    packageJson,
    viteConfig,
    mainJsx,
    appJsx,
    appCss,
  };
}

/**
 * Zip a directory
 */
function zipDirectory(sourceDir) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Deploy FRONTEND to Netlify
 * Important:
 * - Backend URL must already exist.
 * - Vite env must be available BEFORE npm run build.
 * - We deploy dist folder, not raw src files.
 */
async function deployFrontendToNetlify(projectName, code, backendUrl) {
  const netlifyToken = process.env.NETLIFY_TOKEN;

  if (!netlifyToken) {
    throw new Error("NETLIFY_TOKEN missing in .env");
  }

  if (!backendUrl) {
    throw new Error("backendUrl missing. Deploy backend before frontend.");
  }

  const netlifyApi = axios.create({
    baseURL: "https://api.netlify.com/api/v1",
    timeout: 300000,
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
    },
  });

  const safeName = cleanName(projectName);
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), `${safeName}-frontend-`)
  );

  try {
    const files = getFrontendFiles(code, safeName, backendUrl);

    writeFileSafe(path.join(tempRoot, "index.html"), files.indexHtml);
    writeFileSafe(path.join(tempRoot, "package.json"), files.packageJson);
    writeFileSafe(path.join(tempRoot, "vite.config.js"), files.viteConfig);
    writeFileSafe(path.join(tempRoot, "src", "main.jsx"), files.mainJsx);
    writeFileSafe(path.join(tempRoot, "src", "App.jsx"), files.appJsx);
    writeFileSafe(path.join(tempRoot, "src", "App.css"), files.appCss);

    // Vite reads this during build time.
    writeFileSafe(
      path.join(tempRoot, ".env.production"),
      `VITE_API_URL=${backendUrl}\n`
    );

    console.log("📦 Installing frontend dependencies...");
    execSync("npm install", {
      cwd: tempRoot,
      stdio: "inherit",
    });

    console.log("🏗️ Building frontend...");
    execSync("npm run build", {
      cwd: tempRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_API_URL: backendUrl,
      },
    });

    const distDir = path.join(tempRoot, "dist");

    if (!fs.existsSync(distDir)) {
      throw new Error("Frontend build failed: dist folder not found");
    }

    const zipBuffer = await zipDirectory(distDir);

    const siteName = `${safeName}-frontend-${Date.now()}`;

    console.log("🌐 Creating Netlify site:", siteName);

    const createRes = await netlifyApi.post("/sites", {
      name: siteName,
    });

    const siteId = createRes.data.id;

    console.log("📤 Uploading built frontend dist ZIP to Netlify...");

    const deployRes = await netlifyApi.post(
      `/sites/${siteId}/deploys`,
      zipBuffer,
      {
        headers: {
          "Content-Type": "application/zip",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    const liveUrl =
      deployRes.data.ssl_url ||
      deployRes.data.deploy_ssl_url ||
      deployRes.data.url ||
      createRes.data.ssl_url ||
      createRes.data.url;

    if (!liveUrl) {
      throw new Error("Netlify deployed but live URL not found");
    }

    console.log("✅ Netlify frontend deployed:", liveUrl);

    return {
      success: true,
      liveUrl,
      siteId,
      raw: deployRes.data,
    };
  } catch (error) {
    console.error("❌ Netlify deploy error:", error.response?.data || error);

    return {
      success: false,
      liveUrl: null,
      siteId: null,
      message:
        error.response?.data?.message ||
        error.message ||
        "Frontend deploy failed",
      raw: error.response?.data || null,
    };
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Deploy BACKEND to Render
 * Important:
 * - GitHub repo must already contain /backend folder.
 * - Render rootDir must be "backend".
 * - Render API now requires envSpecificDetails for Node services.
 */
async function deployBackendToRender(githubRepoUrl, projectName) {
  const renderApiKey = process.env.RENDER_API_KEY;
  const renderOwnerId = process.env.RENDER_OWNER_ID;

  if (!renderApiKey) {
    throw new Error("RENDER_API_KEY missing in .env");
  }

  if (!renderOwnerId) {
    throw new Error("RENDER_OWNER_ID missing in .env");
  }

  if (!githubRepoUrl) {
    throw new Error("GitHub repo URL missing for Render deploy");
  }

  const safeName = cleanName(projectName);
  const serviceName = `${safeName}-backend-${Date.now()}`;
  const backendUrl = `https://${serviceName}.onrender.com`;

  const renderApi = axios.create({
    baseURL: "https://api.render.com/v1",
    timeout: 300000,
    headers: {
      Authorization: `Bearer ${renderApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const serviceData = {
    type: "web_service",
    name: serviceName,
    ownerId: renderOwnerId,
    repo: githubRepoUrl,
    branch: "main",
    autoDeploy: "yes",
    rootDir: "backend",

    serviceDetails: {
      env: "node",
      plan: "free",
      region: "oregon",

      envSpecificDetails: {
        buildCommand: "npm install",
        startCommand: "npm start",
      },
    },

    envVars: [
      {
        key: "NODE_ENV",
        value: "production",
      },
      {
        key: "MONGO_URI",
        value: process.env.MONGO_URI || "",
      },
      {
        key: "MONGODB_URI",
        value: process.env.MONGODB_URI || process.env.MONGO_URI || "",
      },
      {
        key: "JWT_SECRET",
        value: process.env.JWT_SECRET || "change_this_secret",
      },
    ],
  };

  console.log("📡 Creating Render backend service...");
  console.log("Render service name:", serviceName);
  console.log("GitHub repo:", githubRepoUrl);

  try {
    const response = await renderApi.post("/services", serviceData);

    console.log("✅ Render service created");
    console.log("✅ Backend URL:", backendUrl);

    return {
      success: true,
      backendUrl,
      serviceName,
      serviceId: response.data?.service?.id || response.data?.id || null,
      raw: response.data,
    };
  } catch (error) {
    console.error("❌ Render API error:", error.response?.data || error.message);

    return {
      success: false,
      backendUrl: null,
      serviceName,
      serviceId: null,
      message:
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message,
      raw: error.response?.data || null,
    };
  }
}

module.exports = {
  deployFrontendToNetlify,
  deployBackendToRender,
};