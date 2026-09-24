const express = require("express");
const router = express.Router();
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { subscribe, userIdFromToken } = require("../utils/cleanbridgeEvents.js");

// GET /api/v1/cleanbridge/events?token=<jwt>   (Server-Sent Events)
router.get("/", async (req, res) => {
    let userId;
    try {
        userId = userIdFromToken(req.query.token);
    } catch {
        return res.status(401).json({ msg: "Not authorized" });
    }
    const user = await CleanBridgeUser.findById(userId).select("isActive");
    if (!user || !user.isActive) return res.status(401).json({ msg: "Not authorized" });
    subscribe(req, res, userId);
});

module.exports = router;
