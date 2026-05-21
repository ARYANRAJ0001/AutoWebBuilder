const express = require("express");
const { deployWebsite } = require("../controllers/deployController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/deploy", authenticate, deployWebsite);

module.exports = router;