const express = require('express');
const authMiddleware = require('../middleware/auth');
const { postUpload } = require('../utils/storageMulter');
const { uploadImage } = require('../controllers/ghgpt');

// GH-GPT image upload (multipart), mounted in app.js before express-fileupload,
// which would otherwise consume the body. The JSON routes are in routes/ghgpt.js.
const router = express.Router();

router.post(
    '/uploads',
    authMiddleware,
    postUpload('file', { accept: /^image\//, maxBytes: 10 * 1024 * 1024, kind: 'image' }),
    uploadImage
);

module.exports = router;
