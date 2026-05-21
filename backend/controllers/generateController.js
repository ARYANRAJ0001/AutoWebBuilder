const { generateWebsiteCode } = require("../utils/gemini");
const { sanitizeGeneratedCode } = require("../utils/sanitizeCode");

async function generateWebsite(req, res) {
  try {
    const { prompt, theme, imageDataUrl } = req.body;
    
    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }
    
    const userOpenRouterKey = req.headers["x-openrouter-key"];
    console.log("Generate request received");
    console.log("Prompt length:", prompt.length);
    console.log("Theme:", theme);
    console.log("Using OpenRouter key:", userOpenRouterKey ? "User connected key" : "Common backend key");
    
    const files = await generateWebsiteCode(prompt, theme, userOpenRouterKey, imageDataUrl);
    const cleanFiles = sanitizeGeneratedCode(files);
    
    return res.status(200).json({
      success: true,
      message: "Website generated successfully",
      data: cleanFiles,
      files: cleanFiles,
    });
  } catch (error) {
    console.log("========== GENERATE ERROR FULL ==========");
    console.log("Error name:", error.name);
    console.log("Error code:", error.code);
    console.log("Error message:", error.message);
    if (error.response) {
      console.log("AI status:", error.response.status);
      console.log("AI data:", JSON.stringify(error.response.data, null, 2));
    }
    if (error.request) {
      console.log("AI request sent but no response received");
    }
    console.log("=========================================");
    
    return res.status(500).json({
      success: false,
      message: "Generation failed",
      error: error.response?.data?.error?.message || error.response?.data?.message || error.code || error.message || "Unknown generation error",
    });
  }
}

module.exports = { generateWebsite };