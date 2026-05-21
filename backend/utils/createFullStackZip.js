const archiver = require("archiver");

function addTextFile(archive, filePath, content) {
  archive.append(content || "", { name: filePath });
}

function createFullStackZipBuffer(fullStackCode) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    const chunks = [];

    archive.on("data", (chunk) => chunks.push(chunk));

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (err) => {
      reject(err);
    });

    const frontend = fullStackCode.frontend;
    const backend = fullStackCode.backend;

    addTextFile(archive, "frontend/package.json", frontend.packageJson);
    addTextFile(archive, "frontend/index.html", frontend.indexHtml);
    addTextFile(archive, "frontend/src/main.jsx", frontend.mainJsx);
    addTextFile(archive, "frontend/src/App.jsx", frontend.appJsx);
    addTextFile(archive, "frontend/src/App.css", frontend.appCss);

    addTextFile(archive, "backend/package.json", backend.packageJson);
    addTextFile(archive, "backend/server.js", backend.serverJs);
    addTextFile(archive, "backend/.env.example", backend.envExample);

    addTextFile(archive, "README.md", fullStackCode.readme);

    archive.finalize();
  });
}

module.exports = {
  createFullStackZipBuffer,
};