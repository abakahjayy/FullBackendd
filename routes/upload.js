const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.js");


//Import Controllers
const { upload,uploadProfilePic} = require("../controllers/upload.js");

router.route('/upload-profile-pic').patch(authMiddleware,upload.single("profile_picture"), uploadProfilePic);

module.exports = router;
