const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const { getMyVehicle, upsertMyVehicle, listVehicles, setVerification } = require("../controllers/cleanbridgeVehicle.js");

router.use(cleanbridgeAuth);
router.get("/me", requireRole("collector"), getMyVehicle);
router.put("/me", requireRole("collector"), upsertMyVehicle);
router.get("/", requireRole("admin"), listVehicles);
router.patch("/:id/verification", requireRole("admin"), setVerification);

module.exports = router;
