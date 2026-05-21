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

/**
 * Only generate full-stack code
 */
async function generateFullStackWebsite(req, res) {
  try {
    const { prompt, theme } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    console.log("========== FULL STACK GENERATE ==========");
    console.log("Prompt:", prompt);
    console.log("Theme:", theme || "Default");

    const code = await generateFullStackCode(prompt, theme);

    if (!code || !code.frontend || !code.backend) {
      return res.status(500).json({
        success: false,
        message: "Generated full-stack code is incomplete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Full-stack generated successfully",
      data: code,
    });
  } catch (error) {
    console.error("Full-stack generate error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Full-stack generation failed",
    });
  }
}

/**
 * Deploy already generated full-stack code
 */
async function deployFullStackWebsite(req, res) {
  try {
    const { projectName, code } = req.body;
    const userId = req.user?._id;

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (!code || !code.frontend || !code.backend) {
      return res.status(400).json({
        success: false,
        message: "Valid full-stack code is required",
      });
    }

    const cleanName = cleanProjectName(projectName);

    console.log("========== FULL STACK DEPLOY ==========");
    console.log("Project:", cleanName);

    // 1. Push full-stack project to GitHub
    console.log("📤 Pushing full-stack project to GitHub...");
    const githubResult = await pushFullStackToGithub(cleanName, code);

    if (!githubResult || !githubResult.githubUrl) {
      throw new Error("GitHub push failed: githubUrl missing");
    }

    console.log("✅ GitHub repo:", githubResult.githubUrl);

    // 2. Deploy backend to Render FIRST
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

    // 3. Deploy frontend to Netlify SECOND using backend URL
    console.log("📤 Deploying frontend to Netlify...");
    const frontendResult = await deployFrontendToNetlify(
      cleanName,
      code,
      backendResult.backendUrl
    );

    if (!frontendResult || !frontendResult.success || !frontendResult.liveUrl) {
      throw new Error("Frontend deployment failed on Netlify");
    }

    console.log("✅ Frontend deployed:", frontendResult.liveUrl);

    // 4. Save project if user is logged in
    if (userId) {
      await Project.create({
        projectName: githubResult.repoName || cleanName,
        prompt: "Full-stack project",
        theme: "Modern",
        html: JSON.stringify(code.frontend),
        githubUrl: githubResult.githubUrl,
        liveUrl: frontendResult.liveUrl,
        backendUrl: backendResult.backendUrl,
        isFullStack: true,
        userId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Full-stack app deployed successfully",
      githubUrl: githubResult.githubUrl,
      frontendUrl: frontendResult.liveUrl,
      backendUrl: backendResult.backendUrl,
      renderServiceId: backendResult.serviceId || null,
      netlifySiteId: frontendResult.siteId || null,
      note: "Render free backend may take some time to become active.",
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

/**
 * Generate code + push GitHub + deploy backend + deploy frontend
 */
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

    // 1. Generate full-stack code
    console.log("🧠 Generating full-stack code...");
    const code = await generateFullStackCode(prompt, theme);

    if (!code || !code.frontend || !code.backend) {
      return res.status(500).json({
        success: false,
        message: "Generated full-stack code is incomplete",
      });
    }

    console.log("✅ Full-stack code generated");

    // 2. Push full-stack project to GitHub
    console.log("📤 Pushing full-stack project to GitHub...");
    const githubResult = await pushFullStackToGithub(cleanName, code);

    if (!githubResult || !githubResult.githubUrl) {
      throw new Error("GitHub push failed: githubUrl missing");
    }

    console.log("✅ GitHub repo:", githubResult.githubUrl);

    // 3. Deploy backend to Render FIRST
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

    // 4. Deploy frontend to Netlify SECOND
    console.log("📤 Deploying frontend to Netlify...");
    const frontendResult = await deployFrontendToNetlify(
      cleanName,
      code,
      backendResult.backendUrl
    );

    if (!frontendResult || !frontendResult.success || !frontendResult.liveUrl) {
      throw new Error("Frontend deployment failed on Netlify");
    }

    console.log("✅ Frontend deployed:", frontendResult.liveUrl);

    // 5. Save project if user is logged in
    if (userId) {
      await Project.create({
        projectName: githubResult.repoName || cleanName,
        prompt,
        theme: theme || "Modern",
        html: JSON.stringify(code.frontend),
        githubUrl: githubResult.githubUrl,
        liveUrl: frontendResult.liveUrl,
        backendUrl: backendResult.backendUrl,
        isFullStack: true,
        userId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Full-stack app generated and deployed successfully",
      githubUrl: githubResult.githubUrl,
      frontendUrl: frontendResult.liveUrl,
      backendUrl: backendResult.backendUrl,
      renderServiceId: backendResult.serviceId || null,
      netlifySiteId: frontendResult.siteId || null,
      code,
      note: "Render free backend may take some time to become active.",
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