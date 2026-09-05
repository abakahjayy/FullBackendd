const express = require("express");
const router = express.Router();
const { handleUSSD } = require("../controllers/ussdController");

router.post("/start", handleUSSD);

module.exports = router;
