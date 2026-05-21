const Project = require("../models/Project");

async function getProjects(req, res) {
  try {
    const projects = await Project.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch projects",
    });
  }
}

async function getProjectById(req, res) {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Get project error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch project",
    });
  }
}

async function createProject(req, res) {
  try {
    const { projectName, prompt, theme, html, css, js, githubUrl, liveUrl } =
      req.body;

    if (!projectName || !prompt || !html) {
      return res.status(400).json({
        success: false,
        message: "Project name, prompt, and HTML are required",
      });
    }

    const project = await Project.create({
      projectName,
      prompt,
      theme,
      html,
      css,
      js,
      githubUrl,
      liveUrl,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create project",
    });
  }
}

async function updateProject(req, res) {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const updates = req.body;
    Object.assign(project, updates);
    await project.save();

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    console.error("Update project error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update project",
    });
  }
}

async function deleteProject(req, res) {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete project",
    });
  }
}

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};