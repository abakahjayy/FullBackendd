const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const { getSettings, updatePricing, updatePayouts, updateFuel } = require("../controllers/cleanbridgeSettings.js");

router.get("/", getSettings);
router.put("/pricing", cleanbridgeAuth, requireRole("admin"), updatePricing);
router.put("/payouts", cleanbridgeAuth, requireRole("admin"), updatePayouts);
router.put("/fuel", cleanbridgeAuth, requireRole("admin"), updateFuel);

module.exports = router;
