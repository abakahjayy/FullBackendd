const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.js");


//Import Controllers
const {
    signUp,
    login,
    dashboard,
    userId,
    verifyEmail,
    logout,
    changePassword,
    forgotPassword,
    resetPassword
} = require('../controllers/auth.js');









const { forgotLimiter, resetLimiter } = require("../middleware/passwordResetLimiter.js");
router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password/:token", resetLimiter, resetPassword);
router.post("/reset-password", resetLimiter, resetPassword);

router.route("/signup").post(signUp)
router.route("/login").post(login);
router.route("/logout").post(logout);
router.route("/dashboard").get(authMiddleware,dashboard);
router.route("/userId").post(userId);
router.route("/:userId").patch(changePassword);
router.route('/verify-email').get(verifyEmail)

module.exports = router;
