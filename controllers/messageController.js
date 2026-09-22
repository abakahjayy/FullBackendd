const Message = require('../models/Message.js');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

// sender is always the authenticated user, never taken from req.body -
// otherwise any caller could send a message that appears to be from
// someone else, same fix as the socket.io side in utils/socket.js.
const sendMessage = async (req, res) => {
    const { recipient, message } = req.body;
    const sender = req.user.userId;

    if (!recipient || !message) {
        throw new BadRequestError('recipient and message are required.');
    }

    const newMessage = await Message.create({ sender, recipient, message });
    res.status(StatusCodes.CREATED).json(newMessage);
};

// Only the two participants in a conversation may read it - otherwise any
// authenticated user could read anyone else's DMs just by knowing both
// userIds.
const getMessages = async (req, res) => {
    const { userId1, userId2 } = req.params;
    const requester = req.user.userId;

    if (requester !== userId1 && requester !== userId2) {
        throw new UnauthenticatedError('You are not authorized to view this conversation.');
    }

    const messages = await Message.find({
        $or: [
            { sender: userId1, recipient: userId2 },
            { sender: userId2, recipient: userId1 },
        ],
    }).sort({ timestamp: 1 });

    res.status(StatusCodes.OK).json(messages);
};

// Only the recipient can mark their own inbound message as read.
const markAsRead = async (req, res) => {
    const { messageId } = req.params;
    const requester = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
        throw new NotFoundError(`No message with id ${messageId}`);
    }
    if (String(message.recipient) !== requester) {
        throw new UnauthenticatedError('Only the recipient can mark a message as read.');
    }

    message.read = true;
    await message.save();

    res.status(StatusCodes.OK).json(message);
};

module.exports = { sendMessage, getMessages, markAsRead };
