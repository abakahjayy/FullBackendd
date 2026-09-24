const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const { getBalance, listPayouts, requestPayout, cancelPayout, processPayout } = require("../controllers/cleanbridgePayout.js");

router.use(cleanbridgeAuth);
router.get("/balance", requireRole("collector"), getBalance);
router.get("/", requireRole("collector", "admin"), listPayouts);
router.post("/", requireRole("collector"), requestPayout);
router.delete("/:id", requireRole("collector"), cancelPayout);
router.patch("/:id", requireRole("admin"), processPayout);

module.exports = router;
