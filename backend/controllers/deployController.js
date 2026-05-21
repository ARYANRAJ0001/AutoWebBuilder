const { pushWebsiteToGithub } = require("../utils/github");
const { deployToNetlify } = require("../utils/netlify");
const Project = require("../models/Project");

async function deployWebsite(req, res) {
  try {
    const { projectName, prompt = "", theme = "", html, css = "", js = "" } = req.body;
    const userId = req.user?._id;

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ success: false, message: "Project name required" });
    }
    if (!html || !html.trim()) {
      return res.status(400).json({ success: false, message: "HTML is required" });
    }

    const files = { html, css, js };
    const githubResult = await pushWebsiteToGithub(projectName, files);
    const githubUrl = githubResult.githubUrl || "";

    let netlifyResult = null;
    let netlifyLiveUrl = "";
    try {
      netlifyResult = await deployToNetlify(projectName, files);
      netlifyLiveUrl = netlifyResult?.liveUrl || "";
    } catch (error) {
      console.log("Netlify deploy failed:", error.message);
    }

    const liveUrl = netlifyLiveUrl || githubUrl;

    if (userId) {
      await Project.create({
        projectName: githubResult.repoName,
        prompt, theme, html, css, js,
        githubUrl, liveUrl, userId
      });
    }

    res.json({ success: true, githubUrl, liveUrl, message: netlifyResult ? "Deployed to Netlify" : "Code on GitHub" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { deployWebsite };