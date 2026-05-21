import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";

function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchProjects = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await API.get("/projects");

      setProjects(res.data.projects || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id) => {
    const confirmDelete = window.confirm("Delete this project?");

    if (!confirmDelete) return;

    try {
      await API.delete(`/projects/${id}`);

      setProjects(projects.filter((project) => project._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome, {user.name || "User"}</p>
        </div>

        <div className="dashboard-actions">
          <Link to="/builder" className="primary-link">
            + Create Website
          </Link>

          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {loading && <p>Loading projects...</p>}

      {error && <div className="error-box">{error}</div>}

      {!loading && projects.length === 0 && (
        <div className="empty-box">
          <h2>No websites saved yet</h2>
          <p>Create your first AI website now.</p>
          <Link to="/builder" className="primary-link">
            Create Website
          </Link>
        </div>
      )}

      <div className="project-grid">
        {projects.map((project) => (
          <div className="project-card" key={project._id}>
            <h2>{project.projectName}</h2>

            <p className="project-prompt">
              {project.prompt.slice(0, 120)}...
            </p>

            <p>
              <strong>Theme:</strong> {project.theme}
            </p>

            {project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noreferrer">
                Live Website
              </a>
            )}

            {project.githubUrl && (
              <a href={project.githubUrl} target="_blank" rel="noreferrer">
                GitHub Repo
              </a>
            )}

            <div className="project-buttons">
              <Link to={`/builder/${project._id}`}>Edit</Link>

              <button onClick={() => deleteProject(project._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
