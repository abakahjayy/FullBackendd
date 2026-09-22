const express = require('express');
const authMiddleware = require('../middleware/auth.js');
const { sendMessage, getMessages, markAsRead } = require('../controllers/messageController');
const router = express.Router();

router.use(authMiddleware);

// Send a new message
router.post('/', sendMessage);

// Get messages between two users
router.get('/:userId1/:userId2', getMessages);

// Mark a message as read
router.patch('/:messageId', markAsRead);

module.exports = router;
