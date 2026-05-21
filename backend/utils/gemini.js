const axios = require("axios");
const { jsonrepair } = require("jsonrepair");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  "openrouter/auto",
  "openrouter/free",
  "meta-llama/llama-3.1-8b-instruct:free",
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

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
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

function getSafeMaxTokens() {
  const value = Number(process.env.OPENROUTER_MAX_TOKENS);

  if (Number.isFinite(value) && value >= 1000 && value <= 3500) {
    return value;
  }

  return 3000;
}

function getErrorMessage(error) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.code ||
    error.message ||
    "Unknown error"
  );
}

function createFallbackWebsite(prompt, theme) {
  const title = prompt || "Modern Website";
  const safeTitle = String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="hero" id="home">
    <nav class="navbar">
      <h2 class="logo">Prompt2Site</h2>
      <button class="menu-btn" id="menuBtn">☰</button>
      <ul class="nav-links" id="navLinks">
        <li><a href="#home">Home</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>

    <div class="hero-content">
      <span class="badge">${theme || "Modern Blue"}</span>
      <h1>${safeTitle}</h1>
      <p>A clean, responsive and professional website generated from your prompt.</p>
      <a href="#features" class="btn">Explore Now</a>
    </div>
  </header>

  <main>
    <section class="section" id="features">
      <h2>Key Features</h2>
      <div class="cards">
        <div class="card">
          <h3>Modern Design</h3>
          <p>Beautiful layout with clean spacing, smooth colors and responsive structure.</p>
        </div>
        <div class="card">
          <h3>Mobile Friendly</h3>
          <p>Works properly on mobile, tablet and desktop screens.</p>
        </div>
        <div class="card">
          <h3>Fast Website</h3>
          <p>Simple HTML, CSS and JavaScript with no heavy dependencies.</p>
        </div>
      </div>
    </section>

    <section class="section contact" id="contact">
      <h2>Contact Us</h2>
      <form id="contactForm">
        <input type="text" placeholder="Your name" required>
        <input type="email" placeholder="Your email" required>
        <textarea placeholder="Your message" required></textarea>
        <button class="btn" type="submit">Send Message</button>
      </form>
      <p id="formMsg"></p>
    </section>
  </main>

  <footer>
    <p>© 2026 Prompt2Site. All rights reserved.</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`,

    css: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  color: #102033;
  background: #f4f8ff;
  line-height: 1.6;
}

.hero {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f52ba, #4f9cff, #e8f2ff);
  color: white;
  padding: 24px;
}

.navbar {
  max-width: 1100px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 26px;
  font-weight: 800;
}

.nav-links {
  display: flex;
  gap: 24px;
  list-style: none;
}

.nav-links a {
  color: white;
  text-decoration: none;
  font-weight: 600;
}

.menu-btn {
  display: none;
  border: none;
  background: white;
  color: #0f52ba;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 20px;
}

.hero-content {
  max-width: 850px;
  margin: 130px auto 0;
  text-align: center;
}

.badge {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  padding: 8px 16px;
  border-radius: 999px;
  margin-bottom: 18px;
}

.hero h1 {
  font-size: clamp(38px, 7vw, 72px);
  margin-bottom: 20px;
}

.hero p {
  font-size: 20px;
  margin-bottom: 32px;
}

.btn {
  display: inline-block;
  background: #ffffff;
  color: #0f52ba;
  padding: 13px 24px;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 700;
  border: none;
  cursor: pointer;
}

.section {
  max-width: 1100px;
  margin: auto;
  padding: 80px 24px;
  text-align: center;
}

.section h2 {
  font-size: 36px;
  margin-bottom: 32px;
  color: #0f52ba;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

.card {
  background: white;
  padding: 28px;
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(15, 82, 186, 0.12);
  transition: 0.3s;
}

.card:hover {
  transform: translateY(-8px);
}

.card h3 {
  margin-bottom: 12px;
  color: #0f52ba;
}

.contact form {
  max-width: 550px;
  margin: auto;
  display: grid;
  gap: 14px;
}

input,
textarea {
  width: 100%;
  padding: 14px;
  border: 1px solid #c7d7f2;
  border-radius: 12px;
  font-size: 16px;
}

textarea {
  min-height: 120px;
}

.contact .btn {
  background: #0f52ba;
  color: white;
}

#formMsg {
  margin-top: 16px;
  color: #0f52ba;
  font-weight: 700;
}

footer {
  text-align: center;
  padding: 24px;
  background: #0f52ba;
  color: white;
}

@media (max-width: 768px) {
  .menu-btn {
    display: block;
  }

  .nav-links {
    display: none;
    position: absolute;
    top: 75px;
    left: 24px;
    right: 24px;
    background: white;
    border-radius: 14px;
    padding: 18px;
    flex-direction: column;
  }

  .nav-links.show {
    display: flex;
  }

  .nav-links a {
    color: #0f52ba;
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .hero-content {
    margin-top: 90px;
  }
}`,

    js: `const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const contactForm = document.getElementById("contactForm");
const formMsg = document.getElementById("formMsg");

menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("show");
});

document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
      navLinks.classList.remove("show");
    }
  });
});

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  formMsg.textContent = "Thank you! Your message has been submitted.";
  contactForm.reset();
});`,
  };
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

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a strict JSON generator. Return only valid JSON object with html, css and js keys. No markdown. No explanation.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.3,
    max_tokens: getSafeMaxTokens(),
    response_format: {
      type: "json_object",
    },
  };

  const response = await axios.post(OPENROUTER_URL, requestBody, {
    timeout: 180000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Prompt2Site",
    },
  });

  console.log("OpenRouter response received");

  const message = response.data?.choices?.[0]?.message;
  const text =
    message?.content ||
    message?.reasoning ||
    response.data?.choices?.[0]?.text ||
    "";

  return text;
}

async function generateWebsiteCode(prompt, theme, userOpenRouterKey, imageDataUrl) {
  const apiKey = userOpenRouterKey || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouter key missing. Connect OpenRouter or add OPENROUTER_API_KEY in .env"
    );
  }

  if (!prompt || prompt.trim() === "") {
    throw new Error("Prompt is required");
  }

  console.log("Generate request received");
  console.log("Prompt length:", prompt.length);
  console.log("Theme:", theme || "modern");
  console.log(
    "Using OpenRouter key:",
    userOpenRouterKey ? "User key" : "Common backend key"
  );
  console.log("Safe max tokens:", getSafeMaxTokens());

  const finalPrompt = `
Create a responsive static website.

Topic:
${prompt}

Theme:
${theme || "modern"}

Image:
${imageDataUrl ? "Image is attached. Use it as visual reference." : "No image."}

Rules:
Return ONLY valid JSON.
No markdown.
No explanation.
No backticks.
No comments.
Generate compact code.
HTML must link style.css and script.js.
Make only 3 sections: hero, features, contact.
Keep output short enough for 3000 tokens.

If user asks to include uploaded image, use this src:
UPLOADED_IMAGE_HERE

Return exactly:
{
  "html": "complete index.html",
  "css": "complete style.css",
  "js": "complete script.js"
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

      let html = String(parsed.html).trim();
      let css = String(parsed.css).trim();
      let js = String(parsed.js).trim();

      if (imageDataUrl && html.includes("UPLOADED_IMAGE_HERE")) {
        html = html.replaceAll("UPLOADED_IMAGE_HERE", imageDataUrl);
      }

      return {
        html,
        css,
        js,
      };
    } catch (error) {
      lastError = error;

      console.log("Model failed:", model);
      console.log("Reason:", getErrorMessage(error));

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("All AI models failed. Returning fallback website.");
  console.log("Last error:", getErrorMessage(lastError));

  return createFallbackWebsite(prompt, theme);
}

module.exports = { generateWebsiteCode };