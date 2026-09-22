const express = require("express");
const router = express.Router();
const seedbridgeAuthMiddleware = require("../middleware/seedbridgeAuth.js");
const { signUp, login, getCurrentUser } = require("../controllers/seedbridgeAuth.js");

router.post("/signup", signUp);
router.post("/login", login);
router.get("/me", seedbridgeAuthMiddleware, getCurrentUser);

module.exports = router;
