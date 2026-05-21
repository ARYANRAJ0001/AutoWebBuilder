const express = require("express");

const {
  generateFullStackWebsite,
  deployFullStackWebsite,
  generateAndDeployFullStackWebsite,
} = require("../controllers/fullstackController");

const router = express.Router();

router.post("/generate", generateFullStackWebsite);
router.post("/deploy", deployFullStackWebsite);
router.post("/generate-deploy", generateAndDeployFullStackWebsite);

module.exports = router;
