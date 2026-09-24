const express = require('express');
const authMiddleware = require('../middleware/auth.js');
const { sendMessage, getMessages, markAsRead, getConversations, markConversationRead } = require('../controllers/messageController');
const router = express.Router();

router.use(authMiddleware);

// Send a new message
router.post('/', sendMessage);

// The signed-in user's inbox: one row per person, newest first
router.get('/conversations', getConversations);

// Mark everything a given user sent me as read
router.patch('/conversations/:otherUserId/read', markConversationRead);

// Get messages between two users
router.get('/:userId1/:userId2', getMessages);

// Mark a message as read
router.patch('/:messageId', markAsRead);

module.exports = router;
