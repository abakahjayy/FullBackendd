const express = require("express");
const router = express.Router();
const cleanbridgeAuth = require("../middleware/cleanbridgeAuth.js");
const { requireRole } = require("../middleware/cleanbridgeAuth.js");
const {
    signUp,
    login,
    getCurrentUser,
    updateCurrentUser,
    uploadAvatar,
    removeAvatar,
    updateLiveLocation,
} = require("../controllers/cleanbridgeAuth.js");

// Google sign-in lives on the shared /api/v1/auth/google route with ?app=cleanbridge
// (see routes/googleAuth.js).
router.post("/signup", signUp);
router.post("/login", login);
router.get("/me", cleanbridgeAuth, getCurrentUser);
router.patch("/me", cleanbridgeAuth, updateCurrentUser);
router.put("/me/avatar", cleanbridgeAuth, uploadAvatar);
router.delete("/me/avatar", cleanbridgeAuth, removeAvatar);
router.put("/me/live-location", cleanbridgeAuth, requireRole("collector"), updateLiveLocation);

module.exports = router;
