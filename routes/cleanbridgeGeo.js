const express = require("express");
const rateLimiter = require("express-rate-limit");
const router = express.Router();
const { search, reverse, hubs } = require("../controllers/cleanbridgeGeo.js");

// Public (the booking form is usable before sign-in), but rate limited per IP
// so it can't be used as a free geocoding proxy.
const geoLimiter = rateLimiter({ windowMs: 60 * 1000, max: 90, standardHeaders: true, legacyHeaders: false });

router.get("/search", geoLimiter, search);
router.get("/reverse", geoLimiter, reverse);
router.get("/hubs", hubs);

module.exports = router;
