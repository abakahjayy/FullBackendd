const express = require("express");
const router = express.Router();
const { initiateBundle } = require("../controllers/muviinContoller");

// POST /api/v1/muviin/initiate
router.post("/initiate", initiateBundle);

module.exports = router;
