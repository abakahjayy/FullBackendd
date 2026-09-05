const express = require('express');
const { sendMessage, getMessages, markAsRead } = require('../controllers/messageController');
const router = express.Router();

// Send a new message
router.post('/', sendMessage);

// Get messages between two users
router.get('/:userId1/:userId2', getMessages);

// Mark a message as read
router.patch('/:messageId', markAsRead);

module.exports = router;
