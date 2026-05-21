const axios = require("axios");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

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

function parsePackageJson(pkg) {
  try {
    if (!pkg) return {};
    if (typeof pkg === "string") return JSON.parse(pkg);
    if (typeof pkg === "object") return pkg;
    return {};
  } catch {
    return {};
  }
}

function normalizeFrontendPackageJson(pkg, projectName) {
  const parsed = parsePackageJson(pkg);

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

function injectApiUrlConstant(appJsx, backendUrl) {
  const apiLine = `const API_URL = import.meta.env.VITE_API_URL || "${backendUrl}";\n`;

  if (/const\s+API_URL\s*=/.test(appJsx)) {
    return appJsx.replace(
      /const\s+API_URL\s*=\s*[^;]+;/,
      `const API_URL = import.meta.env.VITE_API_URL || "${backendUrl}";`
    );
  }

  const importRegex = /^(import[\s\S]*?;\s*)+/;

  if (importRegex.test(appJsx)) {
    return appJsx.replace(importRegex, (imports) => `${imports}\n${apiLine}`);
  }

  return `${apiLine}\n${appJsx}`;
}

function patchLocalhostUrls(appJsx) {
  return String(appJsx || "").replace(
    /(["'`])http:\/\/(?:localhost|127\.0\.0\.1):\d+(\/[^"'`]*)?\1/g,
    (match, quote, routePath) => {
      if (routePath) {
        return "`" + "${API_URL}" + routePath + "`";
      }

      return "API_URL";
    }
  );
}

function fixAxiosBaseURL(appJsx) {
  let code = String(appJsx || "");

  code = code.replace(
    /axios\.defaults\.baseURL\s*=\s*["'`][^"'`]+["'`]\s*;/g,
    "axios.defaults.baseURL = API_URL;"
  );

  return code;
}

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
    f.App ||
    f["App.jsx"] ||
    `import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

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

  appJsx = injectApiUrlConstant(appJsx, backendUrl);
  appJsx = patchLocalhostUrls(appJsx);
  appJsx = fixAxiosBaseURL(appJsx);

  const appCss =
    f.appCss ||
    f["src/App.css"] ||
    f.css ||
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

    writeFileSafe(
      path.join(tempRoot, ".env.production"),
      `VITE_API_URL=${backendUrl}\n`
    );

    console.log("========== FRONTEND TEMP FILES ==========");
    console.log("Temp root:", tempRoot);
    console.log("App.jsx length:", files.appJsx.length);
    console.log("Backend URL:", backendUrl);
    console.log("========================================");

    console.log("📦 Installing frontend dependencies...");
    execSync("npm install --include=dev", {
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
        CI: "false",
      },
    });

    const distDir = path.join(tempRoot, "dist");

    if (!fs.existsSync(distDir)) {
      throw new Error("Frontend build failed: dist folder not found");
    }

    const zipBuffer = await zipDirectory(distDir);

    if (!zipBuffer || zipBuffer.length === 0) {
      throw new Error("Frontend ZIP is empty");
    }

    const siteName = `${safeName}-frontend-${Date.now()}`;

    console.log("🌐 Creating Netlify site:", siteName);

    const createRes = await netlifyApi.post("/sites", {
      name: siteName,
    });

    const siteId = createRes.data?.id;

    if (!siteId) {
      throw new Error("Netlify site created but site ID missing");
    }

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
      deployRes.data?.ssl_url ||
      deployRes.data?.deploy_ssl_url ||
      deployRes.data?.url ||
      createRes.data?.ssl_url ||
      createRes.data?.url;

    if (!liveUrl) {
      throw new Error("Netlify deployed but live URL not found");
    }

    console.log("✅ Netlify frontend deployed:", liveUrl);

    return {
      success: true,
      liveUrl,
      netlifyUrl: liveUrl,
      deployUrl: liveUrl,
      siteId,
      siteName,
      raw: deployRes.data,
    };
  } catch (error) {
    console.error("❌ Netlify deploy error:", error.response?.data || error);

    return {
      success: false,
      liveUrl: null,
      netlifyUrl: null,
      deployUrl: null,
      siteId: null,
      message:
        error.response?.data?.message ||
        error.response?.data?.error ||
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