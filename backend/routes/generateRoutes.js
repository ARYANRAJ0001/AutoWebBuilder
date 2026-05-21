const express = require("express");
const { generateWebsite } = require("../controllers/generateController");

const router = express.Router();

router.post("/generate", generateWebsite);

module.exports = router;