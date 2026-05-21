const axios = require("axios");
const archiver = require("archiver");
const { PassThrough } = require("stream");

function getNetlifyApi() {
  if (!process.env.NETLIFY_TOKEN) {
    throw new Error("NETLIFY_TOKEN missing in .env");
  }

  return axios.create({
    baseURL: "https://api.netlify.com/api/v1",
    timeout: 300000,
    headers: {
      Authorization: `Bearer ${process.env.NETLIFY_TOKEN}`,
    },
  });
}

function normalizeInput(input, maybeHtml, maybeCss, maybeJs) {
  /*
    Supports both styles:

    New:
    deployToNetlify({ projectName, html, css, js })

    Old:
    deployToNetlify(projectName, html, css, js)
  */

  if (typeof input === "object" && input !== null) {
    return {
      projectName: input.projectName || "static-website",
      html: input.html,
      css: input.css,
      js: input.js,
    };
  }

  return {
    projectName: input || "static-website",
    html: maybeHtml,
    css: maybeCss,
    js: maybeJs,
  };
}

function cleanSiteName(name) {
  return (
    String(name || "static-website")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 35) || "static-website"
  );
}

function validateFiles(html, css, js) {
  if (!html || !String(html).trim()) {
    throw new Error("Missing HTML content");
  }

  if (!css || !String(css).trim()) {
    throw new Error("Missing CSS content");
  }

  if (!js || !String(js).trim()) {
    throw new Error("Missing JS content");
  }
}

function createZipBuffer({ html, css, js }) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    const stream = new PassThrough();
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    archive.on("error", reject);

    archive.pipe(stream);

    archive.append(String(html), { name: "index.html" });
    archive.append(String(css), { name: "style.css" });
    archive.append(String(js), { name: "script.js" });

    archive.finalize();
  });
}

async function createNetlifySite(api, projectName) {
  const siteName = `${cleanSiteName(projectName)}-${Date.now()}`;

  const response = await api.post("/sites", {
    name: siteName,
  });

  return response.data;
}

async function deployToNetlify(input, maybeHtml, maybeCss, maybeJs) {
  const { projectName, html, css, js } = normalizeInput(
    input,
    maybeHtml,
    maybeCss,
    maybeJs
  );

  validateFiles(html, css, js);

  const api = getNetlifyApi();

  console.log("Creating ZIP for Netlify deploy...");

  const zipBuffer = await createZipBuffer({
    html,
    css,
    js,
  });

  console.log("ZIP created. Size:", zipBuffer.length);

  let siteId = process.env.NETLIFY_SITE_ID;

  /*
    IMPORTANT:
    If NETLIFY_SITE_ID exists, deploy to existing site.
    If not, it tries to create a new site.
    But your Netlify account already hit site creation limit,
    so you should add NETLIFY_SITE_ID in .env.
  */

  if (!siteId) {
    console.log("NETLIFY_SITE_ID missing. Trying to create new Netlify site...");

    const site = await createNetlifySite(api, projectName);
    siteId = site.id;

    console.log("Created Netlify site:", siteId);
  } else {
    console.log("Deploying to existing Netlify site:", siteId);
  }

  const response = await api.post(`/sites/${siteId}/deploys`, zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const deploy = response.data;

  const deployUrl =
    deploy.ssl_url ||
    deploy.deploy_ssl_url ||
    deploy.url ||
    deploy.deploy_url ||
    null;

  return {
    siteId,
    deployId: deploy.id,
    deployUrl,
    netlifyUrl: deployUrl,
    adminUrl: deploy.admin_url || null,
    state: deploy.state || null,
  };
}

module.exports = {
  deployToNetlify,
};