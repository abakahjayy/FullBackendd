const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const { initializePickupPayment, verifyPickupPayment } = require("../controllers/cleanbridgePayment.js");

router.post("/pickups/:id/initialize", cleanbridgeAuth, requireRole("customer"), initializePickupPayment);
router.get("/verify/:reference", cleanbridgeAuth, verifyPickupPayment);

module.exports = router;
