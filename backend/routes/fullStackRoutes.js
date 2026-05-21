const express = require("express");
const router = express.Router();

const {
  generateFullStackWebsite,
  deployFullStackWebsite,
  generateAndDeployFullStackWebsite,
} = require("../controllers/fullStackController");

/*
  Base route in server.js should be:
  app.use("/api/fullstack", fullStackRoutes);

  Final APIs:
  POST /api/fullstack/generate
  POST /api/fullstack/deploy
  POST /api/fullstack/generate-deploy
*/

router.post("/generate", generateFullStackWebsite);

router.post("/deploy", deployFullStackWebsite);

router.post("/generate-deploy", generateAndDeployFullStackWebsite);

module.exports = router;
