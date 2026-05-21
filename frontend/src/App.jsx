import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "https://autowebbuilder.onrender.com";

function App() {
  const [page, setPage] = useState("builder");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [projects, setProjects] = useState([]);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState("Modern Blue");
  const [projectName, setProjectName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [code, setCode] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [fullStackCode, setFullStackCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [fullStackLoading, setFullStackLoading] = useState(false);
  const [fullStackDeploying, setFullStackDeploying] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [fullStackLiveUrl, setFullStackLiveUrl] = useState("");
  const [fullStackGithubUrl, setFullStackGithubUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("static");
  const [deploymentDetails, setDeploymentDetails] = useState(null);
  const [fullStackDeploymentDetails, setFullStackDeploymentDetails] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const isLoggedIn = () => !!localStorage.getItem("token");

  useEffect(() => {
    if (isLoggedIn()) {
      fetchProjects();
    }
  }, []);

  const buildPreviewHtml = (generated) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>${generated.css || ""}</style>
        </head>
        <body>
          ${generated.html || ""}
          <script>${generated.js || ""}</script>
        </body>
      </html>
    `;
  };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleAuthChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const signup = async (e) => {
    e.preventDefault();
    try {
      resetMessages();
      setAuthLoading(true);
      const res = await axios.post(`${API_URL}/api/auth/signup`, {
        name: authForm.name,
        email: authForm.email,
        password: authForm.password,
      });
      
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setPage("dashboard");
      setSuccess("✅ Signup successful!");
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      resetMessages();
      setAuthLoading(true);
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        email: authForm.email,
        password: authForm.password,
      });
      
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setPage("dashboard");
      setSuccess("✅ Login successful!");
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setProjects([]);
    setPage("builder");
    setCode(null);
    setFullStackCode(null);
    setFullStackLiveUrl("");
    setFullStackGithubUrl("");
    setSuccess("Logged out successfully");
  };

  const fetchProjects = async () => {
    try {
      setDashboardLoading(true);
      const res = await axios.get(`${API_URL}/api/projects`, {
        headers: getAuthHeaders(),
      });
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("Fetch projects error:", err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const saveProject = async () => {
    try {
      resetMessages();
      setSaving(true);
      
      if (!isLoggedIn()) {
        setError("Please login first");
        setPage("auth");
        return;
      }
      
      if (!projectName.trim()) {
        setError("Please enter project name");
        return;
      }
      
      if (!code || !code.html) {
        setError("Please generate website first");
        return;
      }

      const payload = {
        projectName,
        prompt,
        theme,
        html: code.html,
        css: code.css || "",
        js: code.js || "",
        githubUrl: githubUrl || "",
        liveUrl: liveUrl || "",
      };

      if (editingProjectId) {
        await axios.put(`${API_URL}/api/projects/${editingProjectId}`, payload, {
          headers: getAuthHeaders(),
        });
        setSuccess("Project updated successfully!");
      } else {
        const res = await axios.post(`${API_URL}/api/projects`, payload, {
          headers: getAuthHeaders(),
        });
        setEditingProjectId(res.data.project?._id || "");
        setSuccess("Project saved successfully!");
      }
      
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const openProjectForEdit = async (projectId) => {
    try {
      resetMessages();
      const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
        headers: getAuthHeaders(),
      });
      const project = res.data.project;
      setEditingProjectId(project._id);
      setProjectName(project.projectName);
      setPrompt(project.prompt);
      setTheme(project.theme);
      const loadedCode = {
        html: project.html,
        css: project.css || "",
        js: project.js || "",
      };
      setCode(loadedCode);
      setPreviewHtml(buildPreviewHtml(loadedCode));
      setGithubUrl(project.githubUrl || "");
      setLiveUrl(project.liveUrl || "");
      setPage("builder");
      setSuccess("Project loaded. You can edit and update it.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open project");
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm("Delete this project?")) return;
    try {
      await axios.delete(`${API_URL}/api/projects/${projectId}`, {
        headers: getAuthHeaders(),
      });
      setProjects(projects.filter((p) => p._id !== projectId));
      if (editingProjectId === projectId) {
        newProject();
      }
      setSuccess("Project deleted successfully!");
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  };

  const newProject = () => {
    setEditingProjectId("");
    setProjectName("");
    setPrompt("");
    setTheme("Modern Blue");
    setImagePreview("");
    setImageDataUrl("");
    setCode(null);
    setPreviewHtml("");
    setLiveUrl("");
    setGithubUrl("");
    setFullStackCode(null);
    setFullStackLiveUrl("");
    setFullStackGithubUrl("");
    setDeploymentDetails(null);
    setFullStackDeploymentDetails(null);
    setError("");
    setSuccess("");
    setActiveTab("static");
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) {
      setError("Image too large. Max 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setImageDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ============ STATIC WEBSITE FUNCTIONS ============
  
  const generateWebsite = async () => {
    try {
      resetMessages();
      setLoading(true);
      
      if (!prompt.trim()) {
        setError("Please enter a prompt first");
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/generate`,
        { prompt, theme, imageDataUrl },
        { timeout: 180000 }
      );
      
      const generated = response.data.data || response.data.files;
      if (!generated || !generated.html) {
        setError("Generated code is incomplete");
        return;
      }
      
      setCode(generated);
      setPreviewHtml(buildPreviewHtml(generated));
      setSuccess("✅ Website generated successfully!");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const deployWebsite = async () => {
    try {
      resetMessages();
      setDeploying(true);
      
      if (!isLoggedIn()) {
        setError("Please login first to deploy");
        setPage("auth");
        return;
      }
      
      if (!projectName.trim()) {
        setError("Please enter project name");
        return;
      }
      
      if (!code || !code.html) {
        setError("Please generate website first");
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/deploy`,
        {
          projectName,
          prompt,
          theme,
          html: code.html,
          css: code.css || "",
          js: code.js || "",
        },
        {
          headers: getAuthHeaders(),
          timeout: 300000,
        }
      );
      
      if (response.data.success) {
        setLiveUrl(response.data.liveUrl);
        setGithubUrl(response.data.githubUrl);
        setDeploymentDetails({
          githubUrl: response.data.githubUrl,
          liveUrl: response.data.liveUrl,
          message: response.data.message
        });
        setSuccess(`✅ Website deployed! Live URL: ${response.data.liveUrl}`);
        
        if (response.data.liveUrl) {
          window.open(response.data.liveUrl, '_blank');
        }
      } else {
        setError(response.data.message || "Deployment failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  const downloadCode = () => {
    if (!code) {
      setError("Generate website first");
      return;
    }
    const fullCode = `================ index.html ================\n\n${code.html}\n\n================ style.css ================\n\n${code.css}\n\n================ script.js ================\n\n${code.js}`;
    const blob = new Blob([fullCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "website"}-code.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess("✅ Code downloaded!");
  };

  // ============ FULL STACK FUNCTIONS ============

  const generateFullStackWebsite = async () => {
    try {
      resetMessages();
      setFullStackLoading(true);
      
      if (!prompt.trim()) {
        setError("Please enter a prompt first");
        return;
      }
      
      console.log("Generating full-stack website...");
      
      const response = await axios.post(
        `${API_URL}/api/fullstack/generate`,
        { prompt, theme },
        { 
          headers: getAuthHeaders(),
          timeout: 180000 
        }
      );
      
      const generated = response.data.data;
      if (!generated || !generated.frontend || !generated.backend) {
        setError("Generated code is incomplete");
        return;
      }
      
      setFullStackCode(generated);
      setFullStackDeploymentDetails(null);
      setSuccess("✅ Full-stack code generated! Click 'Deploy to Netlify' to deploy.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Generation failed");
    } finally {
      setFullStackLoading(false);
    }
  };

  const deployFullStackWebsite = async () => {
    try {
      resetMessages();
      setFullStackDeploying(true);
      
      if (!isLoggedIn()) {
        setError("Please login first");
        setPage("auth");
        return;
      }
      
      if (!projectName.trim()) {
        setError("Please enter project name");
        return;
      }
      
      if (!fullStackCode) {
        setError("Please generate full-stack website first");
        return;
      }
      
      console.log("Deploying full-stack website...");
      
      const response = await axios.post(
        `${API_URL}/api/fullstack/deploy`,
        { projectName, code: fullStackCode },
        { 
          headers: getAuthHeaders(),
          timeout: 300000 
        }
      );
      
      console.log("Deploy response:", response.data);
      
      if (response.data.success) {
        const frontendUrl = response.data.frontendUrl;
        const githubRepoUrl = response.data.githubUrl;
        
        setFullStackLiveUrl(frontendUrl);
        setFullStackGithubUrl(githubRepoUrl);
        
        setFullStackDeploymentDetails({
          githubUrl: githubRepoUrl,
          frontendUrl: frontendUrl,
          backendInstructions: response.data.backendInstructions
        });
        
        setSuccess(`✅ Frontend deployed! Live URL: ${frontendUrl}`);
        
        if (frontendUrl) {
          window.open(frontendUrl, '_blank');
        }
      } else {
        setError(response.data.message || "Deployment failed");
      }
    } catch (err) {
      console.error("Deploy error:", err);
      setError(err.response?.data?.message || err.message || "Deployment failed");
    } finally {
      setFullStackDeploying(false);
    }
  };

  const generateAndDeployFullStack = async () => {
    try {
      resetMessages();
      setFullStackLoading(true);
      
      if (!isLoggedIn()) {
        setError("Please login first");
        setPage("auth");
        return;
      }
      
      if (!projectName.trim()) {
        setError("Please enter project name");
        return;
      }
      
      if (!prompt.trim()) {
        setError("Please enter a prompt first");
        return;
      }
      
      console.log("Generating and deploying full-stack...");
      
      const response = await axios.post(
        `${API_URL}/api/fullstack/generate-deploy`,
        { projectName, prompt, theme },
        { 
          headers: getAuthHeaders(),
          timeout: 3000000 
        }
      );
      
      console.log("Response:", response.data);
      
      if (response.data.success) {
        setFullStackCode(response.data.data);
        
        const frontendUrl = response.data.frontendUrl;
        const githubRepoUrl = response.data.githubUrl;
        
        setFullStackLiveUrl(frontendUrl);
        setFullStackGithubUrl(githubRepoUrl);
        
        setFullStackDeploymentDetails({
          githubUrl: githubRepoUrl,
          frontendUrl: frontendUrl,
          message: response.data.message
        });
        
        setSuccess(`✅ Deployed! Frontend URL: ${frontendUrl}`);
        
        if (frontendUrl) {
          window.open(frontendUrl, '_blank');
        }
      } else {
        setError(response.data.message || "Failed");
      }
    } catch (err) {
      console.error("Generate + deploy error:", err);
      setError(err.response?.data?.message || err.message || "Failed");
    } finally {
      setFullStackLoading(false);
    }
  };

  const downloadFullStackCode = () => {
    if (!fullStackCode) {
      setError("Generate full-stack website first");
      return;
    }
    
    const fullCode = `================ README.md ================
${fullStackCode.readme || "# Full Stack Application"}

================ frontend/package.json ================
${fullStackCode.frontend?.packageJson || ""}

================ frontend/src/App.jsx ================
${fullStackCode.frontend?.appJsx || ""}

================ backend/server.js ================
${fullStackCode.backend?.serverJs || ""}
`;
    
    const blob = new Blob([fullCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "fullstack"}-code.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess("✅ Code downloaded!");
  };

  // ============ AUTH PAGE ============
  
  if (!isLoggedIn()) {
    return (
      <div className="app">
        <div className="animated-bg"><span></span><span></span><span></span><span></span></div>
        <div className="auth-page">
          <form className="auth-card" onSubmit={authMode === "login" ? login : signup}>
            <h1>🚀 Prompt2Site</h1>
            <p>{authMode === "login" ? "Login to save and manage your websites" : "Create account to start generating websites"}</p>
            
            {authMode === "signup" && (
              <input type="text" name="name" placeholder="Full Name" value={authForm.name} onChange={handleAuthChange} required />
            )}
            <input type="email" name="email" placeholder="Email" value={authForm.email} onChange={handleAuthChange} required />
            <input type="password" name="password" placeholder="Password (min 6 characters)" value={authForm.password} onChange={handleAuthChange} required />
            
            <button type="submit" className="primary-btn" disabled={authLoading}>
              {authLoading ? "Please wait..." : (authMode === "login" ? "Login" : "Signup")}
            </button>
            
            <button type="button" className="secondary-btn" onClick={() => { setError(""); setAuthMode(authMode === "login" ? "signup" : "login"); }}>
              {authMode === "login" ? "New user? Create account" : "Already have an account? Login"}
            </button>
            
            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}
          </form>
        </div>
      </div>
    );
  }

  // ============ MAIN APP ============
  
  return (
    <div className="app">
      <div className="animated-bg"><span></span><span></span><span></span><span></span></div>
      
      <header className="header">
        <div>
          <h1>🚀 Prompt2Site</h1>
          <p>Generate, save, and deploy static or full-stack websites from prompts</p>
        </div>
        <div className="header-actions">
          <button className={page === "dashboard" ? "primary-btn" : "secondary-btn"} onClick={() => { fetchProjects(); setPage("dashboard"); }}>
            📁 Dashboard
          </button>
          <button className={page === "builder" ? "primary-btn" : "secondary-btn"} onClick={() => setPage("builder")}>
            🏗️ Builder
          </button>
          <button className="secondary-btn" onClick={newProject}>✨ New Project</button>
          <button className="logout-btn" onClick={logout}>🚪 Logout</button>
        </div>
        <div className="status-pill">👤 {user?.name} | 🔗 {API_URL}</div>
      </header>

      {error && <div className="error-box global-msg">{error}</div>}
      {success && <div className="success-box global-msg">{success}</div>}

      {page === "dashboard" && (
        <main className="dashboard-page">
          <div className="dashboard-header">
            <div>
              <h2>📁 Your Projects</h2>
              <p>{projects.length} project(s) saved</p>
            </div>
            <button className="primary-btn" onClick={newProject}>+ Create New</button>
          </div>
          {dashboardLoading ? (
            <div className="info-box">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="info-box">No projects yet. Go to Builder to create your first website!</div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <div className="project-card" key={project._id}>
                  <h3>{project.projectName}</h3>
                  <p><strong>🎨 Theme:</strong> {project.theme}</p>
                  <p className="project-prompt">📝 {project.prompt?.slice(0, 100)}...</p>
                  {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer">🌐 Live Website</a>}
                  {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer">📦 GitHub Repo</a>}
                  <div className="project-actions">
                    <button className="primary-btn" onClick={() => openProjectForEdit(project._id)}>✏️ Edit</button>
                    <button className="delete-btn" onClick={() => deleteProject(project._id)}>🗑️ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {page === "builder" && (
        <>
          <div className="tab-bar">
            <button className={activeTab === "static" ? "tab-active" : "tab"} onClick={() => setActiveTab("static")}>
              📄 Static Website
            </button>
            <button className={activeTab === "fullstack" ? "tab-active" : "tab"} onClick={() => setActiveTab("fullstack")}>
              ⚛️ Full Stack App (MERN)
            </button>
          </div>

          <main className="main-layout">
            <section className="panel input-panel">
              <h2>{editingProjectId ? "✏️ Edit Project" : "🏗️ Create Website"}</h2>
              
              <label>📛 Project Name</label>
              <input 
                type="text" 
                placeholder="my-awesome-website" 
                value={projectName} 
                onChange={(e) => setProjectName(e.target.value)} 
              />

              <label>🎨 Theme</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option>Modern Blue</option>
                <option>Classic Dark</option>
                <option>Luxury Gold</option>
                <option>Fitness Green</option>
                <option>Startup Purple</option>
                <option>Minimal White</option>
                <option>Cyberpunk Neon</option>
                <option>Nature Organic</option>
              </select>

              <label>💬 Your Prompt</label>
              <textarea 
                rows="4" 
                placeholder="Example: Create a todo app with add, delete, and mark complete features..." 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
              />

              <div className="tool-row">
                <label className="upload-btn">
                  🖼️ Upload Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </label>
                {imagePreview && (
                  <button className="secondary-btn" onClick={() => { setImagePreview(""); setImageDataUrl(""); }}>
                    🗑️ Remove Image
                  </button>
                )}
              </div>

              {imagePreview && (
                <div className="image-preview-box">
                  <img src={imagePreview} alt="preview" />
                </div>
              )}

              {/* STATIC WEBSITE SECTION */}
              {activeTab === "static" && (
                <>
                  <div className="info-box">
                    <strong>📄 Static Website Generator</strong>
                    <p>Generates pure HTML/CSS/JS websites that can be deployed anywhere.</p>
                  </div>
                  
                  <div className="action-row">
                    <button className="primary-btn" onClick={generateWebsite} disabled={loading}>
                      {loading ? "⏳ Generating..." : "🚀 Generate Website"}
                    </button>
                    <button className="save-btn" onClick={saveProject} disabled={saving || !code}>
                      💾 {saving ? "Saving..." : (editingProjectId ? "Update" : "Save")}
                    </button>
                    <button className="deploy-btn" onClick={deployWebsite} disabled={deploying || !code}>
                      {deploying ? "⏳ Deploying..." : "🌐 Deploy to Netlify"}
                    </button>
                    <button className="download-btn" onClick={downloadCode} disabled={!code}>
                      📥 Download Code
                    </button>
                  </div>

                  {deploymentDetails && (
                    <div className="success-box">
                      <strong>✅ Deployment Successful!</strong><br/>
                      🌐 <a href={deploymentDetails.liveUrl} target="_blank" rel="noopener noreferrer">{deploymentDetails.liveUrl}</a><br/>
                      📦 <a href={deploymentDetails.githubUrl} target="_blank" rel="noopener noreferrer">GitHub Repository</a>
                    </div>
                  )}
                </>
              )}

              {/* FULL STACK SECTION */}
              {activeTab === "fullstack" && (
                <>
                  <div className="info-box">
                    <strong>⚛️ Full Stack MERN Application</strong>
                    <p>Generates React frontend + Node.js/Express backend with MongoDB.</p>
                  </div>

                  <div className="action-row">
                    <button 
                      className="primary-btn" 
                      onClick={generateFullStackWebsite} 
                      disabled={fullStackLoading}
                    >
                      {fullStackLoading ? "⏳ Generating..." : "🚀 Generate Full Stack"}
                    </button>
                    
                    <button 
                      className="deploy-btn" 
                      onClick={deployFullStackWebsite} 
                      disabled={fullStackDeploying || !fullStackCode}
                    >
                      {fullStackDeploying ? "⏳ Deploying..." : "🌐 Deploy to Netlify"}
                    </button>
                    
                    <button 
                      className="save-btn" 
                      onClick={generateAndDeployFullStack} 
                      disabled={fullStackLoading || fullStackDeploying}
                    >
                      {fullStackLoading ? "⏳ Processing..." : "✨ Generate + Deploy"}
                    </button>
                  </div>

                  <div className="action-row">
                    <button 
                      className="download-btn" 
                      onClick={downloadFullStackCode} 
                      disabled={!fullStackCode}
                      style={{ width: '100%' }}
                    >
                      📥 Download Full Stack Code
                    </button>
                  </div>

                  {/* Show live URL after deployment */}
                  {fullStackLiveUrl && (
                    <div className="success-box" style={{ marginTop: '1rem' }}>
                      <strong>✅ Frontend Live!</strong><br/>
                      🌐 <a href={fullStackLiveUrl} target="_blank" rel="noopener noreferrer">{fullStackLiveUrl}</a><br/>
                      📦 <a href={fullStackGithubUrl} target="_blank" rel="noopener noreferrer">GitHub Repository</a>
                    </div>
                  )}

                  {/* Show deployment instructions */}
                  {fullStackDeploymentDetails && fullStackDeploymentDetails.backendInstructions && (
                    <div className="info-box" style={{ marginTop: '1rem', background: '#e3f2fd' }}>
                      <strong>📋 Deploy Backend on Render:</strong>
                      <ol style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                        <li>Go to <a href="https://render.com" target="_blank">render.com</a> and sign up</li>
                        <li>Click "New +" → "Web Service"</li>
                        <li>Connect GitHub repo: <code>{fullStackDeploymentDetails.githubUrl}</code></li>
                        <li>Build Command: <code>cd backend && npm install</code></li>
                        <li>Start Command: <code>cd backend && node server.js</code></li>
                        <li>Add env var: <code>MONGO_URI=your_mongodb_connection_string</code></li>
                        <li>After deploy, copy URL and add to Netlify env: <code>VITE_API_URL</code></li>
                      </ol>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="panel preview-panel">
              <div className="preview-header">
                <h2>👁️ Live Preview</h2>
                {code && <span className="badge">Static Ready</span>}
                {fullStackCode && <span className="badge">Full Stack Ready</span>}
              </div>
              {previewHtml ? (
                <iframe title="Preview" srcDoc={previewHtml} className="preview-frame" />
              ) : fullStackCode ? (
                <div className="empty-preview">
                  <h3>⚛️ Full Stack Code Generated</h3>
                  <p>Click <strong>Deploy to Netlify</strong> to see your live application!</p>
                </div>
              ) : (
                <div className="empty-preview">
                  <h3>No preview yet</h3>
                  <p>Enter a prompt and click Generate</p>
                </div>
              )}
            </section>
          </main>

          {code && (
            <section className="code-section">
              <h2>📝 Generated Static Code</h2>
              <details>
                <summary>📄 index.html</summary>
                <textarea value={code.html} onChange={(e) => setCode({ ...code, html: e.target.value })} rows={15} />
              </details>
              <details>
                <summary>🎨 style.css</summary>
                <textarea value={code.css} onChange={(e) => setCode({ ...code, css: e.target.value })} rows={15} />
              </details>
              <details>
                <summary>⚡ script.js</summary>
                <textarea value={code.js} onChange={(e) => setCode({ ...code, js: e.target.value })} rows={10} />
              </details>
            </section>
          )}

          {fullStackCode && (
            <section className="code-section">
              <h2>📝 Generated Full Stack Code</h2>
              <details>
                <summary>📖 README.md</summary>
                <textarea value={fullStackCode.readme || ""} onChange={(e) => setFullStackCode({ ...fullStackCode, readme: e.target.value })} rows={10} />
              </details>
              <details>
                <summary>⚛️ frontend/src/App.jsx</summary>
                <textarea value={fullStackCode.frontend?.appJsx || ""} onChange={(e) => setFullStackCode({ ...fullStackCode, frontend: { ...fullStackCode.frontend, appJsx: e.target.value } })} rows={20} />
              </details>
              <details>
                <summary>🖥️ backend/server.js</summary>
                <textarea value={fullStackCode.backend?.serverJs || ""} onChange={(e) => setFullStackCode({ ...fullStackCode, backend: { ...fullStackCode.backend, serverJs: e.target.value } })} rows={20} />
              </details>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default App;
