const axios = require("axios");
const archiver = require("archiver");

function getNetlifyApi() {
  if (!process.env.NETLIFY_TOKEN) throw new Error("NETLIFY_TOKEN missing");
  return axios.create({ baseURL: "https://api.netlify.com/api/v1", headers: { Authorization: `Bearer ${process.env.NETLIFY_TOKEN}` } });
}

function makeCompleteHtml(html, css, js) {
  let finalHtml = html.trim();
  if (!finalHtml.toLowerCase().includes("<!doctype html")) {
    finalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Website</title><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
  }
  return finalHtml;
}

async function createSiteZipBuffer(files) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    const finalHtml = makeCompleteHtml(files.html, files.css, files.js);
    archive.append(finalHtml, { name: "index.html" });
    if (files.css) archive.append(files.css, { name: "style.css" });
    if (files.js) archive.append(files.js, { name: "script.js" });
    archive.finalize();
  });
}

async function deployToNetlify(projectName, files) {
  const netlifyApi = getNetlifyApi();
  let siteId = process.env.NETLIFY_SITE_ID;
  if (!siteId) {
    const siteName = `${projectName}-${Date.now()}`;
    const createRes = await netlifyApi.post("/sites", { name: siteName });
    siteId = createRes.data.id;
  }
  const zipBuffer = await createSiteZipBuffer(files);
  const deployRes = await netlifyApi.post(`/sites/${siteId}/deploys`, zipBuffer, {
    headers: { "Content-Type": "application/zip" }, maxBodyLength: Infinity
  });
  const liveUrl = deployRes.data.ssl_url || deployRes.data.deploy_ssl_url || deployRes.data.url;
  return { liveUrl, siteId };
}

async function deployFrontendToNetlify(projectName, code) {
  const netlifyToken = process.env.NETLIFY_TOKEN;
  if (!netlifyToken) throw new Error("NETLIFY_TOKEN missing");

  const netlifyApi = axios.create({
    baseURL: "https://api.netlify.com/api/v1",
    headers: { Authorization: `Bearer ${netlifyToken}` },
  });

  return new Promise(async (resolve, reject) => {
    try {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks = [];

      archive.on("data", (chunk) => chunks.push(chunk));
      archive.on("end", async () => {
        const zipBuffer = Buffer.concat(chunks);
        const siteName = `${projectName}-frontend-${Date.now()}`;
        const createRes = await netlifyApi.post("/sites", { name: siteName });
        const siteId = createRes.data.id;
        const deployRes = await netlifyApi.post(`/sites/${siteId}/deploys`, zipBuffer, {
          headers: { "Content-Type": "application/zip" }, maxBodyLength: Infinity
        });
        const liveUrl = deployRes.data.ssl_url || deployRes.data.deploy_ssl_url || deployRes.data.url;
        resolve({ success: true, liveUrl, siteId });
      });

      archive.on("error", reject);

      const f = code.frontend;
      archive.append(f.indexHtml || `<!DOCTYPE html><html><head><title>${projectName}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`, { name: "index.html" });
      archive.append(f.packageJson || `{"name":"${projectName}","type":"module","scripts":{"dev":"vite","build":"vite build"},"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0","axios":"^1.5.0"},"devDependencies":{"@vitejs/plugin-react":"^4.0.0","vite":"^4.4.0"}}`, { name: "package.json" });
      archive.append(`import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()], server: { port: 3000 } })`, { name: "vite.config.js" });
      archive.append(f.mainJsx || `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nReactDOM.createRoot(document.getElementById('root')).render(<App />)`, { name: "src/main.jsx" });
      archive.append(f.appJsx || `import { useState, useEffect } from 'react'\nimport axios from 'axios'\nconst API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'\nfunction App() {\n const [todos, setTodos] = useState([])\n useEffect(() => { axios.get(API_URL + '/api/todos').then(res => setTodos(res.data.data)) }, [])\n return <div><h1>${projectName}</h1>{todos.map(todo => <div key={todo._id}>{todo.title}</div>)}</div>\n}\nexport default App`, { name: "src/App.jsx" });
      archive.append(f.appCss || `* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: system-ui; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }`, { name: "src/App.css" });
      
      archive.finalize();
    } catch (error) { reject(error); }
  });
}

module.exports = { deployToNetlify, deployFrontendToNetlify, createSiteZipBuffer };