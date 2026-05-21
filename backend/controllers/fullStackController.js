const { generateFullStackCode } = require("../utils/fullStackGemini");
const { pushFullStackToGithub } = require("../utils/github");
const {
  deployFrontendToNetlify,
  deployBackendToRender,
} = require("../utils/deployBoth");
const Project = require("../models/Project");

function cleanProjectName(name) {
  return (
    String(name || "fullstack-app")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "fullstack-app"
  );
}

function getCodeFromBody(body) {
  return body?.code || body?.data || body?.generatedCode || null;
}

function isValidFullStackCode(code) {
  if (!code || typeof code !== "object") return false;
  if (!code.frontend || typeof code.frontend !== "object") return false;
  if (!code.backend || typeof code.backend !== "object") return false;

  const frontend = code.frontend;
  const backend = code.backend;

  const hasApp =
    frontend.appJsx ||
    frontend["src/App.jsx"] ||
    frontend.App ||
    frontend["App.jsx"];

  const hasServer =
    backend.serverJs ||
    backend["server.js"] ||
    backend.appJs ||
    backend["app.js"];

  return Boolean(hasApp && hasServer);
}

function normalizeFullStackCode(code, projectName) {
  const cleanName = cleanProjectName(projectName);

  const frontend = code.frontend || {};
  const backend = code.backend || {};

  const normalized = {
    frontend: {
      packageJson:
        frontend.packageJson ||
        frontend["package.json"] ||
        JSON.stringify(
          {
            name: `${cleanName}-frontend`,
            version: "1.0.0",
            private: true,
            type: "module",
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              "@vitejs/plugin-react": "^4.2.1",
              vite: "^5.0.0",
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              axios: "^1.6.0",
            },
            devDependencies: {},
          },
          null,
          2
        ),

      indexHtml:
        frontend.indexHtml ||
        frontend["index.html"] ||
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${cleanName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

      mainJsx:
        frontend.mainJsx ||
        frontend["src/main.jsx"] ||
        `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

      appJsx:
        frontend.appJsx ||
        frontend["src/App.jsx"] ||
        frontend.App ||
        frontend["App.jsx"],

      appCss:
        frontend.appCss ||
        frontend["src/App.css"] ||
        frontend.css ||
        `body {
  margin: 0;
  font-family: system-ui, Arial, sans-serif;
}

.app {
  padding: 30px;
}`,

      viteConfig:
        frontend.viteConfig ||
        frontend["vite.config.js"] ||
        `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`,
    },

    backend: {
      packageJson:
        backend.packageJson ||
        backend["package.json"] ||
        JSON.stringify(
          {
            name: `${cleanName}-backend`,
            version: "1.0.0",
            main: "server.js",
            scripts: {
              start: "node server.js",
              dev: "nodemon server.js",
            },
            dependencies: {
              express: "^4.18.2",
              cors: "^2.8.5",
              dotenv: "^16.4.5",
              mongoose: "^8.0.0",
            },
          },
          null,
          2
        ),

      serverJs:
        backend.serverJs ||
        backend["server.js"] ||
        backend.appJs ||
        backend["app.js"],
    },
  };

  return normalized;
}

async function saveProjectSafely({
  userId,
  projectName,
  prompt,
  theme,
  code,
  githubUrl,
  frontendUrl,
  backendUrl,
}) {
  try {
    if (!userId) return;

    await Project.create({
      projectName,
      prompt: prompt || "Full-stack project",
      theme: theme || "Modern",
      html: JSON.stringify(code?.frontend || {}),
      css: "",
      js: "",
      githubUrl,
      liveUrl: frontendUrl,
      backendUrl,
      isFullStack: true,
      userId,
    });
  } catch (error) {
    console.error("⚠️ Project save failed:", error.message);
  }
}

async function generateFullStackWebsite(req, res) {
  try {
    const { prompt, theme, projectName } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    console.log("========== FULL STACK GENERATE ==========");
    console.log("Prompt:", prompt);
    console.log("Theme:", theme || "Default");

    const rawCode = await generateFullStackCode(prompt, theme);
    const code = normalizeFullStackCode(
      rawCode,
      projectName || "fullstack-app"
    );

    if (!isValidFullStackCode(code)) {
      return res.status(500).json({
        success: false,
        message:
          "Generated full-stack code is incomplete. Frontend App.jsx or backend server.js missing.",
        data: code,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Full-stack generated successfully",
      data: code,
      code,
    });
  } catch (error) {
    console.error("Full-stack generate error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Full-stack generation failed",
    });
  }
}

async function deployFullStackWebsite(req, res) {
  try {
    const { projectName, prompt, theme } = req.body;
    const userId = req.user?._id;

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const rawCode = getCodeFromBody(req.body);

    if (!rawCode) {
      return res.status(400).json({
        success: false,
        message: "Full-stack code is required",
      });
    }

    const cleanName = cleanProjectName(projectName);
    const code = normalizeFullStackCode(rawCode, cleanName);

    if (!isValidFullStackCode(code)) {
      return res.status(400).json({
        success: false,
        message:
          "Valid full-stack code is required. Frontend App.jsx and backend server.js are required.",
      });
    }

    console.log("========== FULL STACK DEPLOY ==========");
    console.log("Project:", cleanName);

    console.log("📤 Pushing full-stack project to GitHub...");
    const githubResult = await pushFullStackToGithub(cleanName, code);

    if (!githubResult || !githubResult.githubUrl) {
      throw new Error("GitHub push failed: githubUrl missing");
    }

    console.log("✅ GitHub repo:", githubResult.githubUrl);

    console.log("🚀 Deploying backend to Render...");
    const backendResult = await deployBackendToRender(
      githubResult.githubUrl,
      cleanName
    );

    if (!backendResult || !backendResult.success || !backendResult.backendUrl) {
      throw new Error(
        backendResult?.message || "Backend deployment failed on Render"
      );
    }

    console.log("✅ Backend deployed:", backendResult.backendUrl);

    console.log("📤 Deploying frontend to Netlify...");
    const frontendResult = await deployFrontendToNetlify(
      cleanName,
      code,
      backendResult.backendUrl
    );

    if (!frontendResult || !frontendResult.success || !frontendResult.liveUrl) {
      throw new Error(
        frontendResult?.message || "Frontend deployment failed on Netlify"
      );
    }

    console.log("✅ Frontend deployed:", frontendResult.liveUrl);

    await saveProjectSafely({
      userId,
      projectName: githubResult.repoName || cleanName,
      prompt,
      theme,
      code,
      githubUrl: githubResult.githubUrl,
      frontendUrl: frontendResult.liveUrl,
      backendUrl: backendResult.backendUrl,
    });

    return res.status(200).json({
      success: true,
      message: "Full-stack app deployed successfully",
      githubUrl: githubResult.githubUrl,
      liveUrl: frontendResult.liveUrl,
      frontendUrl: frontendResult.liveUrl,
      backendUrl: backendResult.backendUrl,
      deployUrl: frontendResult.liveUrl,
      renderServiceId: backendResult.serviceId || null,
      netlifySiteId: frontendResult.siteId || null,
      note: "Render free backend may take some time to become active.",
      data: {
        githubUrl: githubResult.githubUrl,
        liveUrl: frontendResult.liveUrl,
        frontendUrl: frontendResult.liveUrl,
        backendUrl: backendResult.backendUrl,
        deployUrl: frontendResult.liveUrl,
      },
    });
  } catch (error) {
    console.error("Full-stack deploy error:", error.response?.data || error);

    return res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Full-stack deployment failed",
      details: error.response?.data || null,
    });
  }
}

async function generateAndDeployFullStackWebsite(req, res) {
  try {
    const { prompt, theme, projectName } = req.body;
    const userId = req.user?._id;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const cleanName = cleanProjectName(projectName);

    console.log("========== GENERATE + DEPLOY FULL STACK ==========");
    console.log("Project:", cleanName);
    console.log("Prompt:", prompt);
    console.log("Theme:", theme || "Default");

    console.log("🧠 Generating full-stack code...");
    const rawCode = await generateFullStackCode(prompt, theme);
    const code = normalizeFullStackCode(rawCode, cleanName);

    if (!isValidFullStackCode(code)) {
      return res.status(500).json({
        success: false,
        message:
          "Generated full-stack code is incomplete. Frontend App.jsx or backend server.js missing.",
        data: code,
      });
    }

    console.log("✅ Full-stack code generated");

    console.log("📤 Pushing full-stack project to GitHub...");
    const githubResult = await pushFullStackToGithub(cleanName, code);

    if (!githubResult || !githubResult.githubUrl) {
      throw new Error("GitHub push failed: githubUrl missing");
    }

    console.log("✅ GitHub repo:", githubResult.githubUrl);

    console.log("🚀 Deploying backend to Render...");
    const backendResult = await deployBackendToRender(
      githubResult.githubUrl,
      cleanName
    );

    if (!backendResult || !backendResult.success || !backendResult.backendUrl) {
      throw new Error(
        backendResult?.message || "Backend deployment failed on Render"
      );
    }

    console.log("✅ Backend deployed:", backendResult.backendUrl);

    console.log("📤 Deploying frontend to Netlify...");
    const frontendResult = await deployFrontendToNetlify(
      cleanName,
      code,
      backendResult.backendUrl
    );

    if (!frontendResult || !frontendResult.success || !frontendResult.liveUrl) {
      throw new Error(
        frontendResult?.message || "Frontend deployment failed on Netlify"
      );
    }

    console.log("✅ Frontend deployed:", frontendResult.liveUrl);

    await saveProjectSafely({
      userId,
      projectName: githubResult.repoName || cleanName,
      prompt,
      theme,
      code,
      githubUrl: githubResult.githubUrl,
      frontendUrl: frontendResult.liveUrl,
      backendUrl: backendResult.backendUrl,
    });

    return res.status(200).json({
      success: true,
      message: "Full-stack app generated and deployed successfully",
      githubUrl: githubResult.githubUrl,
      liveUrl: frontendResult.liveUrl,
      frontendUrl: frontendResult.liveUrl,
      backendUrl: backendResult.backendUrl,
      deployUrl: frontendResult.liveUrl,
      renderServiceId: backendResult.serviceId || null,
      netlifySiteId: frontendResult.siteId || null,
      code,
      note: "Render free backend may take some time to become active.",
      data: {
        githubUrl: githubResult.githubUrl,
        liveUrl: frontendResult.liveUrl,
        frontendUrl: frontendResult.liveUrl,
        backendUrl: backendResult.backendUrl,
        deployUrl: frontendResult.liveUrl,
        code,
      },
    });
  } catch (error) {
    console.error("Generate + deploy error:", error.response?.data || error);

    return res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Generate + deploy failed",
      details: error.response?.data || null,
    });
  }
}

module.exports = {
  generateFullStackWebsite,
  deployFullStackWebsite,
  generateAndDeployFullStackWebsite,
};