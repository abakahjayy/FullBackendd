const express = require('express');
const authMiddleware = require('../middleware/auth');
const { postUpload } = require('../utils/storageMulter');
const { createPost, updateMyPhoto } = require('../controllers/instagramSocialController');

// Multipart parts of the logged-in Instagram API. Mounted in app.js BEFORE
// express-fileupload/body parsers (like posts, stories, voice notes); the JSON
// routes are in routes/instagramRoutes.js.
const router = express.Router();
router.post('/posts', authMiddleware, postUpload('file'), createPost);
router.patch('/me/photo', authMiddleware, postUpload('photo', { accept: /^image\//, maxBytes: 10 * 1024 * 1024, kind: 'image' }), updateMyPhoto);

module.exports = router;
