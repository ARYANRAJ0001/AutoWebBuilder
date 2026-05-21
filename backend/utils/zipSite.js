const archiver = require("archiver");

function createSiteZipBuffer(files) {
  return new Promise((resolve, reject) => {
    if (!files || !files.html || !files.css || !files.js) {
      return reject(new Error("HTML, CSS, and JS files are required for zip"));
    }

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    const chunks = [];

    archive.on("data", (chunk) => {
      chunks.push(chunk);
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.on("warning", (err) => {
      console.log("Zip warning:", err.message);
    });

    archive.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });

    archive.append(files.html, { name: "index.html" });
    archive.append(files.css, { name: "style.css" });
    archive.append(files.js, { name: "script.js" });

    archive.finalize();
  });
}

module.exports = { createSiteZipBuffer };