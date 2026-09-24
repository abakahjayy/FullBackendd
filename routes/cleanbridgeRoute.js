const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const { createRoute, listRoutes, getTodayRoute, getRoute, updateRouteStatus } = require("../controllers/cleanbridgeRoute.js");

router.use(cleanbridgeAuth, requireRole("collector", "admin"));
router.get("/", listRoutes);
router.post("/", createRoute);
router.get("/today", requireRole("collector"), getTodayRoute);
router.get("/:id", getRoute);
router.patch("/:id/status", updateRouteStatus);

module.exports = router;
