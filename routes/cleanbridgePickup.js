const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const {
    getQuote,
    createPickup,
    listPickups,
    listAvailablePickups,
    getPickup,
    acceptPickup,
    assignPickup,
    updatePickupStatus,
    ratePickup,
    markRefunded,
} = require("../controllers/cleanbridgePickup.js");

router.post("/quote", getQuote);
router.get("/", cleanbridgeAuth, listPickups);
router.post("/", cleanbridgeAuth, requireRole("customer"), createPickup);
router.get("/available", cleanbridgeAuth, requireRole("collector", "admin"), listAvailablePickups);
router.get("/:id", cleanbridgeAuth, getPickup);
router.patch("/:id/accept", cleanbridgeAuth, requireRole("collector"), acceptPickup);
router.patch("/:id/assign", cleanbridgeAuth, requireRole("admin"), assignPickup);
router.patch("/:id/status", cleanbridgeAuth, updatePickupStatus);
router.post("/:id/rate", cleanbridgeAuth, requireRole("customer"), ratePickup);
router.patch("/:id/refund", cleanbridgeAuth, requireRole("admin"), markRefunded);

module.exports = router;
