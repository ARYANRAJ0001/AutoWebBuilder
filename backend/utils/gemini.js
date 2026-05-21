const axios = require("axios");
const { jsonrepair } = require("jsonrepair");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  "openrouter/auto",
  "openrouter/free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free"
];

function cleanAIText(text) {
  let cleaned = text || "";
  cleaned = cleaned.trim();
  cleaned = cleaned
    .replace(/```json/g, "")
    .replace(/```html/g, "")
    .replace(/```css/g, "")
    .replace(/```javascript/g, "")
    .replace(/```js/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function parseAIJson(text) {
  const cleaned = cleanAIText(text);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairError) {
      console.log("AI raw response:", cleaned.substring(0, 500));
      throw new Error("AI did not return valid JSON");
    }
  }
}

async function callOpenRouter(finalPrompt, apiKey, model, imageDataUrl) {
  console.log("Trying model:", model);
  console.log("Sending request to OpenRouter...");
  console.log("Image attached:", !!imageDataUrl);

  const userContent = imageDataUrl
    ? [
        {
          type: "text",
          text: finalPrompt,
        },
        {
          type: "image_url",
          image_url: {
            url: imageDataUrl,
          },
        },
      ]
    : finalPrompt;

  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        {
          role: "system",
          content: "You are a strict JSON generator and expert frontend developer. If an image is provided, analyze all visible content, text, colors, layout, objects, style, and design. If user asks to include the uploaded image in the website, include it using the exact placeholder UPLOADED_IMAGE_HERE in an img src.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    },
    {
      timeout: 180000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Prompt2Site",
      },
    }
  );

  console.log("OpenRouter response received");
  const message = response.data.choices?.[0]?.message;
  const text = message?.content || message?.reasoning || response.data.choices?.[0]?.text || "";
  return text;
}

async function generateWebsiteCode(prompt, theme, userOpenRouterKey, imageDataUrl) {
  const apiKey = userOpenRouterKey || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouter key missing. Connect OpenRouter or add OPENROUTER_API_KEY in .env");
  }

  if (!prompt || prompt.trim() === "") {
    throw new Error("Prompt is required");
  }

  const finalPrompt = `
You are an expert frontend developer.

Create a complete responsive static website with 4 to 6 sections.

User prompt:
${prompt}

Theme:
${theme || "modern"}

Uploaded image:
${imageDataUrl ? "An uploaded image is attached. Scan and understand all visible content, text, layout, colors, people/objects, and design style from it." : "No image uploaded."}

Rules:
1. Return ONLY valid JSON.
2. Do not use markdown.
3. Do not include explanation.
4. Generate only HTML, CSS, and JavaScript.
5. The HTML must link style.css and script.js.
6. Website should be modern, responsive, and professional.
7. Do not include document.cookie, eval, localStorage token stealing, or external tracking scripts.
8. Do not include backticks in the JSON string values.
9. Do not include JSON comments.
10. Escape all quotes properly inside JSON strings.
11. Return only one JSON object.
12. Keep the total code compact but complete.
13. If an uploaded image is attached, use it as visual reference and scan its content.
14. If the user asks to put/use/add/include the uploaded image in the website, then put this exact image source in HTML: UPLOADED_IMAGE_HERE
15. Do not invent image details if no image is attached.

Website quality requirements:
1. Understand the topic deeply and add rich, relevant content yourself.
2. Add topic-related images using safe public image URLs (Unsplash, Pexels).
3. Add responsive layout with CSS Grid/Flexbox.
4. Add attractive animated background gradient.
5. Add beautiful hero section with headline, subheading, and CTA button.
6. Add topic-based color theme with CSS variables.
7. Add responsive navbar with mobile menu.
8. Add professional footer with links.
9. Add cards, sections, services, or features based on the topic.
10. Add smooth hover effects and transitions.
11. Add scroll animations (fade-in effects).
12. Make it fully mobile-friendly.
13. Use clean modern typography (Google Fonts).
14. Add proper spacing and padding.
15. Add call-to-action buttons with hover effects.
16. Add useful headings, subheadings, and content sections.
17. Add JavaScript interactivity (mobile menu toggle, smooth scroll, form validation).
18. Personalize content if user provides name, business, goal, age, weight, product, service, location, or category.
19. Make it feel like a complete production-ready website.
20. Add contact section or form where relevant.
21. Add testimonial section with dummy data.

Return this exact JSON structure:
{
  "html": "complete index.html code",
  "css": "complete style.css code", 
  "js": "complete script.js code"
}
`;

  let lastError;

  for (const model of MODELS) {
    try {
      const text = await callOpenRouter(finalPrompt, apiKey, model, imageDataUrl);
      
      if (!text || text.trim() === "") {
        throw new Error("AI returned empty response");
      }

      const parsed = parseAIJson(text);

      if (!parsed.html || !parsed.css || !parsed.js) {
        throw new Error("Generated code is incomplete - missing html, css, or js");
      }

      let html = parsed.html;
      let css = parsed.css;
      let js = parsed.js;

      if (imageDataUrl && html.includes("UPLOADED_IMAGE_HERE")) {
        html = html.replaceAll("UPLOADED_IMAGE_HERE", imageDataUrl);
      }

      return {
        html: html.trim(),
        css: css.trim(),
        js: js.trim(),
      };
    } catch (error) {
      lastError = error;
      console.log("Model failed:", model);
      console.log("Reason:", error.response?.data?.error?.message || error.code || error.message || "Unknown error");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error(lastError?.response?.data?.error?.message || lastError?.code || lastError?.message || "All AI models failed");
}

module.exports = { generateWebsiteCode };