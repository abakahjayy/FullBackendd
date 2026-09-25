const express = require('express');
const rateLimit = require('express-rate-limit');
const { StatusCodes } = require('http-status-codes');
const authMiddleware = require('../middleware/auth');
const cleanbridgeAuth = require('../middleware/cleanbridgeAuth');
const { BadRequestError } = require('../errors');
const { getPublicKey, pushToUser, pushToSubscription, saveSubscription, removeSubscription } = require('../utils/push');
const User = require('../models/User');

// Web Push device notifications for every app (/api/v1/push). See utils/push.js.
const router = express.Router();
const testLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

const USER_APPS = ['ghgpt', 'instagram'];
const TEST_MESSAGES = {
    ghgpt: { title: 'GH-GPT notifications are on', body: "You'll get alerts for sign-ins, emails and finished images on this device.", url: '/dashboard' },
    instagram: { title: 'Nsoro notifications are on', body: "You'll get alerts for messages, likes, comments and follows on this device.", url: '/notifications' },
    cleanbridge: { title: 'CleanBridge notifications are on', body: "You'll get pickup updates on this device.", url: '/notifications' },
};

// Right after a device turns notifications on (or a different account signs in on it),
// send it one notification, so the user sees it working in the notification bar.
async function confirmDevice({ subscription, isNew }, app, userId) {
    if (!isNew) return;
    let who = '';
    if (app !== 'cleanbridge') {
        const user = await User.findById(userId, 'username').lean().catch(() => null);
        if (user?.username) who = `Signed in as @${user.username}. `;
    }
    const msg = TEST_MESSAGES[app];
    await pushToSubscription(subscription, { ...msg, body: who + msg.body, tag: 'push-on' });
}

router.get('/public-key', async (req, res) => {
    res.status(StatusCodes.OK).json({ publicKey: await getPublicKey() });
});

// Shared User accounts (GH-GPT, Instagram).
router.post('/subscribe', authMiddleware, async (req, res) => {
    const { app, subscription } = req.body;
    if (!USER_APPS.includes(app)) throw new BadRequestError(`app must be one of: ${USER_APPS.join(', ')}`);
    const saved = await saveSubscription({ userId: req.user.userId, realm: 'user', app, subscription, userAgent: req.headers['user-agent'] });
    confirmDevice(saved, app, req.user.userId);
    res.status(StatusCodes.CREATED).json({ subscribed: true });
});

router.post('/unsubscribe', authMiddleware, async (req, res) => {
    if (!req.body.endpoint) throw new BadRequestError('endpoint is required');
    await removeSubscription(String(req.body.endpoint), req.user.userId);
    res.status(StatusCodes.OK).json({ subscribed: false });
});

router.post('/test', authMiddleware, testLimiter, async (req, res) => {
    const app = USER_APPS.includes(req.body.app) ? req.body.app : 'ghgpt';
    const delivered = await pushToUser(req.user.userId, { ...TEST_MESSAGES[app], tag: 'test' }, { app });
    res.status(StatusCodes.OK).json({ delivered });
});

// CleanBridge has its own user collection and tokens.
router.post('/cleanbridge/subscribe', cleanbridgeAuth, async (req, res) => {
    const saved = await saveSubscription({ userId: req.user.userId, realm: 'cleanbridge', app: 'cleanbridge', subscription: req.body.subscription, userAgent: req.headers['user-agent'] });
    confirmDevice(saved, 'cleanbridge', req.user.userId);
    res.status(StatusCodes.CREATED).json({ subscribed: true });
});

router.post('/cleanbridge/unsubscribe', cleanbridgeAuth, async (req, res) => {
    if (!req.body.endpoint) throw new BadRequestError('endpoint is required');
    await removeSubscription(String(req.body.endpoint), req.user.userId);
    res.status(StatusCodes.OK).json({ subscribed: false });
});

router.post('/cleanbridge/test', cleanbridgeAuth, testLimiter, async (req, res) => {
    const delivered = await pushToUser(req.user.userId, { ...TEST_MESSAGES.cleanbridge, tag: 'test' }, { app: 'cleanbridge', realm: 'cleanbridge' });
    res.status(StatusCodes.OK).json({ delivered });
});

module.exports = router;
