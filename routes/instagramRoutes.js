const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { unsubscribePage, unsubscribe, setEmailPreference, sendUpdate } = require('../controllers/instagramController');
const social = require('../controllers/instagramSocialController');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/email/unsubscribe', limiter, unsubscribePage);
router.post('/email/unsubscribe', limiter, unsubscribe);
router.patch('/settings/email', authMiddleware, setEmailPreference);
router.post('/updates', authMiddleware, adminOnly, sendUpdate);

// Logged-in social actions (the user comes from the token, never the request body).
// Uploads (POST /posts, PATCH /me/photo) live in routes/instagramUploadRoutes.js.
router.delete('/posts/:postId', authMiddleware, social.deletePost);
router.patch('/posts/:postId/like', authMiddleware, social.likePost);
router.patch('/posts/:postId/unlike', authMiddleware, social.unlikePost);
router.post('/posts/:postId/comments', authMiddleware, social.addComment);
router.delete('/comments/:commentId', authMiddleware, social.deleteComment);
router.patch('/users/:targetId/follow', authMiddleware, social.follow);
router.patch('/users/:targetId/unfollow', authMiddleware, social.unfollow);
router.patch('/me', authMiddleware, social.updateMe);

module.exports = router;
