const express = require("express");
const rateLimiter = require("express-rate-limit");
const router = express.Router();
const { unsubscribePage, unsubscribe } = require("../controllers/cleanbridgeEmail.js");

const limiter = rateLimiter({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get("/unsubscribe", limiter, unsubscribePage);
router.post("/unsubscribe", limiter, unsubscribe);

module.exports = router;
