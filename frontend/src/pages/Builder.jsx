import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import API from "../api";

const API_URL = "http://localhost:1256";

function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEditMode = Boolean(id);

  const [projectName, setProjectName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState("Modern Blue");

  const [code, setCode] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const buildPreview = (html, css, js) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${css || ""}</style>
      </head>
      <body>
        ${html || ""}
        <script>${js || ""}</script>
      </body>
      </html>
    `;
  };

  const loadProject = async () => {
    try {
      setError("");

      const res = await API.get(`/projects/${id}`);

      const project = res.data.project;

      setProjectName(project.projectName);
      setPrompt(project.prompt);
      setTheme(project.theme);

      const loadedCode = {
        html: project.html,
        css: project.css,
        js: project.js,
        githubUrl: project.githubUrl,
        liveUrl: project.liveUrl,
      };

      setCode(loadedCode);
      setPreviewHtml(buildPreview(project.html, project.css, project.js));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load project");
    }
  };

  useEffect(() => {
    if (isEditMode) {
      loadProject();
    }
  }, [id]);

  const generateWebsite = async () => {
    try {
      setError("");
      setSuccess("");
      setLoading(true);

      if (!prompt.trim()) {
        setError("Please enter a prompt");
        return;
      }

      const res = await API.post("/generate", {
        prompt,
        theme,
      });

      const generated = res.data.data;

      setCode(generated);
      setPreviewHtml(
        buildPreview(generated.html, generated.css, generated.js)
      );

      setSuccess("Website generated successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Generate failed");
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async () => {
    try {
      setError("");
      setSuccess("");
      setSaving(true);

      if (!projectName.trim()) {
        setError("Project name is required");
        return;
      }

      if (!prompt.trim()) {
        setError("Prompt is required");
        return;
      }

      if (!code?.html || !code?.css) {
        setError("Generate website first before saving");
        return;
      }

      const payload = {
        projectName,
        prompt,
        theme,
        html: code.html,
        css: code.css,
        js: code.js || "",
        githubUrl: code.githubUrl || "",
        liveUrl: code.liveUrl || "",
      };

      if (isEditMode) {
        await API.put(`/projects/${id}`, payload);
        setSuccess("Project updated successfully");
      } else {
        await API.post("/projects", payload);
        setSuccess("Project saved successfully");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="builder-page">
      <div className="top-bar">
        <h1>{isEditMode ? "Edit Website" : "Create Website"}</h1>

        <Link to="/dashboard">Back to Dashboard</Link>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="builder-layout">
        <div className="builder-form">
          <label>Project Name</label>
          <input
            type="text"
            placeholder="Example: Fitness Website"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />

          <label>Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option>Modern Blue</option>
            <option>Classic Dark</option>
            <option>Luxury Gold</option>
            <option>Minimal White</option>
            <option>Creative Gradient</option>
          </select>

          <label>Prompt</label>
          <textarea
            placeholder="Example: Create a modern gym website with diet plan, exercise list and animated background"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="button-row">
            <button onClick={generateWebsite} disabled={loading}>
              {loading ? "Generating..." : "Generate Website"}
            </button>

            <button onClick={saveProject} disabled={saving}>
              {saving
                ? "Saving..."
                : isEditMode
                ? "Update Project"
                : "Save Project"}
            </button>
          </div>

          {code && (
            <div className="code-boxes">
              <h3>HTML</h3>
              <textarea
                value={code.html}
                onChange={(e) => {
                  const updated = { ...code, html: e.target.value };
                  setCode(updated);
                  setPreviewHtml(
                    buildPreview(updated.html, updated.css, updated.js)
                  );
                }}
              />

              <h3>CSS</h3>
              <textarea
                value={code.css}
                onChange={(e) => {
                  const updated = { ...code, css: e.target.value };
                  setCode(updated);
                  setPreviewHtml(
                    buildPreview(updated.html, updated.css, updated.js)
                  );
                }}
              />

              <h3>JavaScript</h3>
              <textarea
                value={code.js}
                onChange={(e) => {
                  const updated = { ...code, js: e.target.value };
                  setCode(updated);
                  setPreviewHtml(
                    buildPreview(updated.html, updated.css, updated.js)
                  );
                }}
              />
            </div>
          )}
        </div>

        <div className="preview-section">
          <h2>Live Preview</h2>

          {previewHtml ? (
            <iframe
              title="Website Preview"
              srcDoc={previewHtml}
              className="preview-frame"
            />
          ) : (
            <div className="preview-empty">
              Generate website to see preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Builder;