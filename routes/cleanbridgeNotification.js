const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { listNotifications, markRead, markAllRead } = require("../controllers/cleanbridgeNotification.js");

router.use(cleanbridgeAuth);
router.get("/", listNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

module.exports = router;
