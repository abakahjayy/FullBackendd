const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const ghgpt = require('../controllers/ghgpt');

// GH-GPT logged-in API (/api/v1/ghgpt). The image upload route is in
// routes/ghgptUploadRoutes.js (mounted earlier, before express-fileupload).
const router = express.Router();

const emailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { msg: 'Too many emails, please wait a few minutes.' } });
const unsubscribeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post('/chats/:chatId/stream', authMiddleware, ghgpt.streamMessage);
router.patch('/chats/:chatId/title', authMiddleware, ghgpt.renameChat);
router.patch('/chats/:chatId/pin', authMiddleware, ghgpt.pinChat);
router.post('/chats/:chatId/email', authMiddleware, emailLimiter, ghgpt.emailChat);

router.post('/events', authMiddleware, ghgpt.authEvent); // welcome / new sign-in emails
router.get('/settings', authMiddleware, ghgpt.getSettings);
router.patch('/settings/email', authMiddleware, ghgpt.setEmailPreference);

router.get('/email/unsubscribe', unsubscribeLimiter, ghgpt.unsubscribePage);
router.post('/email/unsubscribe', unsubscribeLimiter, ghgpt.unsubscribe);

module.exports = router;
