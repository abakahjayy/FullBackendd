const express = require('express');
const authMiddleware = require('../middleware/auth.js');
const { sendMessage, editMessage, deleteMessage, getMessages, markAsRead, getConversations, markConversationRead } = require('../controllers/messageController');
const router = express.Router();

router.use(authMiddleware);

// Send a new message (voice notes: routes/messageVoiceRoute.js, mounted earlier in app.js)
router.post('/', sendMessage);

// Edit / unsend your own message
router.patch('/:messageId/edit', editMessage);
router.delete('/:messageId', deleteMessage);

// The signed-in user's inbox: one row per person, newest first
router.get('/conversations', getConversations);

// Mark everything a given user sent me as read
router.patch('/conversations/:otherUserId/read', markConversationRead);

// Get messages between two users
router.get('/:userId1/:userId2', getMessages);

// Mark a message as read
router.patch('/:messageId', markAsRead);

module.exports = router;
