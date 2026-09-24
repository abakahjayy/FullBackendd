const express = require("express");
const router = express.Router();
const seedbridgeAuthMiddleware = require("../middleware/seedbridgeAuth.js");
const { signUp, login, getCurrentUser, forgotPassword, resetPassword } = require("../controllers/seedbridgeAuth.js");
const { forgotLimiter, resetLimiter } = require("../middleware/passwordResetLimiter.js");

router.post("/signup", signUp);
router.post("/login", login);
router.get("/me", seedbridgeAuthMiddleware, getCurrentUser);
router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password/:token", resetLimiter, resetPassword);
router.post("/reset-password", resetLimiter, resetPassword);

module.exports = router;
