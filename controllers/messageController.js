const mongoose = require('mongoose');
const Message = require('../models/Message.js');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');
const { emitToUserId } = require('../utils/socket');
const { emailNewMessage } = require('../utils/socialNotify');

// Push a message event to both participants' open tabs/devices.
const emitToBoth = (msg, event, payload) => {
    emitToUserId(String(msg.sender), event, payload);
    emitToUserId(String(msg.recipient), event, payload);
};

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
    emitToUserId(String(recipient), 'receiveMessage', newMessage);
    emailNewMessage(sender, recipient);
    res.status(StatusCodes.CREATED).json(newMessage);
};

// POST /messages/voice (multipart "audio" + recipient + duration) - voice note.
const sendVoiceMessage = async (req, res) => {
    const { recipient } = req.body;
    const sender = req.user.userId;
    if (!req.file) throw new BadRequestError('No audio was received.');
    if (!recipient || !mongoose.Types.ObjectId.isValid(recipient)) {
        await new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' }).delete(req.file.id).catch(() => {});
        throw new BadRequestError('recipient is required.');
    }
    const duration = Math.max(0, Math.min(Number(req.body.duration) || 0, 600));
    const newMessage = await Message.create({ sender, recipient, type: 'voice', audioFileId: req.file.id, duration });
    // recipient + the sender's other tabs (the sending tab uses the response)
    emitToBoth(newMessage, 'receiveMessage', newMessage);
    emailNewMessage(sender, recipient);
    res.status(StatusCodes.CREATED).json(newMessage);
};

// PATCH /messages/:messageId/edit - sender only, text messages only.
const editMessage = async (req, res) => {
    const { messageId } = req.params;
    const text = String(req.body.message || '').trim();
    if (!mongoose.Types.ObjectId.isValid(messageId)) throw new BadRequestError('Invalid message id.');
    if (!text) throw new BadRequestError('Message cannot be empty.');
    const msg = await Message.findById(messageId);
    if (!msg) throw new NotFoundError(`No message with id ${messageId}`);
    if (String(msg.sender) !== req.user.userId) throw new UnauthenticatedError('You can only edit your own messages.');
    if (msg.type === 'voice') throw new BadRequestError('Voice messages cannot be edited.');
    msg.message = text;
    msg.editedAt = new Date();
    await msg.save();
    emitToBoth(msg, 'messageUpdated', msg);
    res.status(StatusCodes.OK).json(msg);
};

// DELETE /messages/:messageId - "unsend": removes it for both people (sender only).
const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) throw new BadRequestError('Invalid message id.');
    const msg = await Message.findById(messageId);
    if (!msg) throw new NotFoundError(`No message with id ${messageId}`);
    if (String(msg.sender) !== req.user.userId) throw new UnauthenticatedError('You can only unsend your own messages.');
    if (msg.audioFileId) {
        await new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' }).delete(msg.audioFileId).catch(() => {});
    }
    await Message.deleteOne({ _id: msg._id });
    emitToBoth(msg, 'messageDeleted', { _id: String(msg._id) });
    res.status(StatusCodes.OK).json({ deleted: true, _id: msg._id });
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

// One entry per person the signed-in user has messaged with: their public
// profile fields, the latest message and how many of theirs are unread.
const getConversations = async (req, res) => {
    const me = new mongoose.Types.ObjectId(req.user.userId);

    const conversations = await Message.aggregate([
        { $match: { $or: [{ sender: me }, { recipient: me }] } },
        { $sort: { timestamp: -1 } },
        {
            $group: {
                _id: { $cond: [{ $eq: ['$sender', me] }, '$recipient', '$sender'] },
                lastMessage: { $first: '$$ROOT' },
                unread: {
                    $sum: { $cond: [{ $and: [{ $eq: ['$recipient', me] }, { $eq: ['$read', false] }] }, 1, 0] },
                },
            },
        },
        { $sort: { 'lastMessage.timestamp': -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
            $project: {
                _id: 0,
                lastMessage: 1,
                unread: 1,
                user: {
                    _id: '$user._id',
                    username: '$user.username',
                    firstName: '$user.firstName',
                    lastName: '$user.lastName',
                    profile_picture_id: '$user.profile_picture_id',
                    profile_picture: '$user.profile_picture',
                },
            },
        },
    ]);

    res.status(StatusCodes.OK).json({ conversations });
};

const markConversationRead = async (req, res) => {
    const { otherUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
        throw new BadRequestError('Please provide a valid user id.');
    }
    const result = await Message.updateMany(
        { sender: otherUserId, recipient: req.user.userId, read: false },
        { $set: { read: true } }
    );
    res.status(StatusCodes.OK).json({ updated: result.nModified ?? result.modifiedCount ?? 0 });
};

module.exports = { sendMessage, sendVoiceMessage, editMessage, deleteMessage, getMessages, markAsRead, getConversations, markConversationRead };
