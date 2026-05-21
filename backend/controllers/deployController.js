const { pushWebsiteToGithub } = require("../utils/github");
const { deployToNetlify } = require("../utils/netlify");

function getBodyValue(body, keys, fallback = "") {
  for (const key of keys) {
    if (typeof body?.[key] !== "undefined" && body[key] !== null) {
      return body[key];
    }
  }

  if (body?.data && typeof body.data === "object") {
    for (const key of keys) {
      if (typeof body.data?.[key] !== "undefined" && body.data[key] !== null) {
        return body.data[key];
      }
    }
  }

  if (body?.code && typeof body.code === "object") {
    for (const key of keys) {
      if (typeof body.code?.[key] !== "undefined" && body.code[key] !== null) {
        return body.code[key];
      }
    }
  }

  return fallback;
}

function cleanStaticWebsiteData(reqBody) {
  const projectName = getBodyValue(reqBody, ["projectName", "name", "title"]);
  const prompt = getBodyValue(reqBody, ["prompt"], "");
  const theme = getBodyValue(reqBody, ["theme"], "Modern Blue");

  const html = getBodyValue(reqBody, [
    "html",
    "HTML",
    "htmlContent",
    "indexHtml",
    "index.html",
  ]);

  const css = getBodyValue(reqBody, [
    "css",
    "CSS",
    "cssContent",
    "styleCss",
    "style.css",
  ]);

  const js = getBodyValue(reqBody, [
    "js",
    "JS",
    "javascript",
    "javascriptContent",
    "scriptJs",
    "script.js",
  ], "");

  return {
    projectName: String(projectName || "").trim(),
    prompt: String(prompt || "").trim(),
    theme: String(theme || "Modern Blue").trim(),

    // Main names
    html: String(html || "").trim(),
    css: String(css || "").trim(),
    js: String(js || "").trim(),

    // Extra aliases for old utils/github.js or utils/netlify.js
    htmlContent: String(html || "").trim(),
    cssContent: String(css || "").trim(),
    jsContent: String(js || "").trim(),
    indexHtml: String(html || "").trim(),
    styleCss: String(css || "").trim(),
    scriptJs: String(js || "").trim(),
  };
}

async function deployWebsite(req, res) {
  try {
    const websiteData = cleanStaticWebsiteData(req.body);

    console.log("========== STATIC DEPLOY REQUEST ==========");
    console.log("Project name:", websiteData.projectName);
    console.log("Prompt:", websiteData.prompt);
    console.log("Theme:", websiteData.theme);
    console.log("HTML length:", websiteData.html.length);
    console.log("CSS length:", websiteData.css.length);
    console.log("JS length:", websiteData.js.length);
    console.log("GitHub token loaded:", !!process.env.GITHUB_TOKEN);
    console.log("Netlify token loaded:", !!process.env.NETLIFY_TOKEN);
    console.log("==========================================");

    if (!websiteData.projectName) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (!websiteData.html) {
      return res.status(400).json({
        success: false,
        message: "HTML content is required",
      });
    }

    if (!websiteData.css) {
      return res.status(400).json({
        success: false,
        message: "CSS content is required",
      });
    }

    let githubResult = null;
    let githubErrorMessage = "";

    try {
      githubResult = await pushWebsiteToGithub(websiteData);

      console.log(
        "GitHub push success:",
        githubResult?.githubUrl || githubResult?.repoUrl || githubResult?.url
      );
    } catch (githubError) {
      githubErrorMessage =
        githubError?.response?.data?.message ||
        githubError?.message ||
        "GitHub push failed";

      console.log("GitHub push failed but continuing to Netlify");
      console.log("GitHub error:", githubErrorMessage);
    }

    let netlifyResult = null;

    try {
      netlifyResult = await deployToNetlify(websiteData);

      console.log(
        "Netlify deploy success:",
        netlifyResult?.liveUrl ||
          netlifyResult?.netlifyUrl ||
          netlifyResult?.deployUrl ||
          netlifyResult?.url
      );
    } catch (netlifyError) {
      const netlifyMessage =
        netlifyError?.response?.data?.message ||
        netlifyError?.response?.data?.error ||
        netlifyError?.message ||
        "Netlify deploy failed";

      console.log("Netlify deploy failed");
      console.log("Netlify error:", netlifyMessage);
      console.log("Netlify response:", netlifyError?.response?.data);

      return res.status(500).json({
        success: false,
        message: "Netlify deploy failed",
        error: netlifyMessage,
        githubError: githubErrorMessage,
        githubUrl:
          githubResult?.githubUrl ||
          githubResult?.repoUrl ||
          githubResult?.url ||
          "",
        liveUrl: "",
        netlifyUrl: "",
        deployUrl: "",
        data: {
          githubUrl:
            githubResult?.githubUrl ||
            githubResult?.repoUrl ||
            githubResult?.url ||
            "",
          liveUrl: "",
          netlifyUrl: "",
          deployUrl: "",
        },
      });
    }

    const githubUrl =
      githubResult?.githubUrl ||
      githubResult?.repoUrl ||
      githubResult?.url ||
      "";

    const liveUrl =
      netlifyResult?.liveUrl ||
      netlifyResult?.netlifyUrl ||
      netlifyResult?.deployUrl ||
      netlifyResult?.ssl_url ||
      netlifyResult?.url ||
      "";

    if (!liveUrl) {
      return res.status(500).json({
        success: false,
        message: "Netlify deployed but live URL not found",
        githubUrl,
        githubError: githubErrorMessage,
        data: {
          githubUrl,
          liveUrl: "",
          netlifyUrl: "",
          deployUrl: "",
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website deployed successfully",
      githubUrl,
      liveUrl,
      netlifyUrl: liveUrl,
      deployUrl: liveUrl,
      githubError: githubErrorMessage,
      data: {
        githubUrl,
        liveUrl,
        netlifyUrl: liveUrl,
        deployUrl: liveUrl,
        siteId: netlifyResult?.siteId || netlifyResult?.id || "",
        siteName: netlifyResult?.siteName || netlifyResult?.name || "",
      },
    });
  } catch (error) {
    console.log("========== STATIC DEPLOY ERROR FULL ==========");
    console.log("Error name:", error.name);
    console.log("Error code:", error.code);
    console.log("Error message:", error.message);
    console.log("Error response:", error.response?.data);
    console.log("=============================================");

    return res.status(500).json({
      success: false,
      message: "Deployment failed",
      error: error.message,
      details: error.response?.data || null,
    });
  }
}

module.exports = {
  deployWebsite,
};