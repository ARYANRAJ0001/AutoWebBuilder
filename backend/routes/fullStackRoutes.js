const express = require("express");
const {
  generateFullStackWebsite,
  deployFullStackWebsite,
  generateAndDeployFullStackWebsite,
} = require("../controllers/fullstackController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/generate", generateFullStackWebsite);
router.post("/deploy", authenticate, deployFullStackWebsite);
router.post("/generate-deploy", authenticate, generateAndDeployFullStackWebsite);

module.exports = router;