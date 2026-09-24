const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getNotifications, markAllRead } = require('../controllers/socialNotificationController');

const router = express.Router();
router.use(authMiddleware);

router.get('/', getNotifications);
router.patch('/read', markAllRead);

module.exports = router;
