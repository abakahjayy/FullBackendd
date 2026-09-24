const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { unsubscribePage, unsubscribe, setEmailPreference, sendUpdate } = require('../controllers/instagramController');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/email/unsubscribe', limiter, unsubscribePage);
router.post('/email/unsubscribe', limiter, unsubscribe);
router.patch('/settings/email', authMiddleware, setEmailPreference);
router.post('/updates', authMiddleware, adminOnly, sendUpdate);

module.exports = router;
