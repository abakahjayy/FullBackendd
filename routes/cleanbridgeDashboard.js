const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const {
    getCustomerDashboard,
    getCollectorDashboard,
    getAdminDashboard,
    getAnalytics,
} = require("../controllers/cleanbridgeDashboard.js");

router.use(cleanbridgeAuth);
router.get("/customer", requireRole("customer"), getCustomerDashboard);
router.get("/collector", requireRole("collector"), getCollectorDashboard);
router.get("/admin", requireRole("admin"), getAdminDashboard);
router.get("/analytics", requireRole("admin"), getAnalytics);

module.exports = router;
