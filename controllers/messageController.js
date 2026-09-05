const Message = require('../models/Message.js');

// Send a new message
const sendMessage = async (req, res) => {
    const { sender, recipient, message } = req.body;

    if (!sender || !recipient || !message) {
        return res.status(400).json({ error: 'Sender, recipient, and message are required.' });
    }

    try {
        const newMessage = await Message.create({ sender, recipient, message });
        return res.status(201).json(newMessage);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to send message.' });
    }
};

// Get messages between two users
const getMessages = async (req, res) => {
    const { userId1, userId2 } = req.params;

    try {
        const messages = await Message.find({
            $or: [
                { sender: userId1, recipient: userId2 },
                { sender: userId2, recipient: userId1 },
            ],
        }).sort({ timestamp: 1 });

        return res.status(200).json(messages);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch messages.' });
    }
};

// Mark messages as read
const markAsRead = async (req, res) => {
    const { messageId } = req.params;

    try {
        const message = await Message.findByIdAndUpdate(
            messageId,
            { read: true },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        return res.status(200).json(message);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to mark message as read.' });
    }
};

module.exports = { sendMessage, getMessages, markAsRead };
