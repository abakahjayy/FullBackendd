const express = require('express');
const authMiddleware = require('../middleware/auth.js');
const { postUpload } = require('../utils/storageMulter');
const { sendVoiceMessage } = require('../controllers/messageController');

// POST /api/v1/messages/voice - voice notes in DMs. Its own router because multipart
// uploads must be mounted in app.js before express-fileupload/body parsers consume the
// body (same reason as posts and stories). Browsers record audio/webm or audio/mp4;
// 10 MB is roughly ten minutes of voice.
const router = express.Router();
router.post('/', authMiddleware, postUpload('audio', { accept: /^audio\//, maxBytes: 10 * 1024 * 1024, kind: 'audio' }), sendVoiceMessage);

module.exports = router;
