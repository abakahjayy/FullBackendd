const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const {
    listCustomers,
    listCollectors,
    createUser,
    setUserActive,
    broadcast,
    liveMap,
} = require("../controllers/cleanbridgeAdmin.js");

router.use(cleanbridgeAuth, requireRole("admin"));
router.get("/customers", listCustomers);
router.get("/collectors", listCollectors);
router.post("/users", createUser);
router.patch("/users/:id/active", setUserActive);
router.post("/broadcast", broadcast);
router.get("/live", liveMap);

module.exports = router;
