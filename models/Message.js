const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please Provide the Sender UserId']
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please Provide the Receiver UserId']
    },
    // 'voice' messages carry an audio file (GridFS `uploads`, served by
    // /api/v1/posts/media/:audioFileId) instead of text.
    type: { type: String, enum: ['text', 'voice'], default: 'text' },
    message: {
        type: String,
        required: [function () { return this.type !== 'voice'; }, 'Please Provide the Message'],
        default: ''
    },
    audioFileId: { type: mongoose.Schema.Types.ObjectId },
    duration: { type: Number, default: 0 }, // seconds, voice only
    editedAt: { type: Date, default: null }, // set when the sender edits the text
    read: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        // Function, not Date.now() - that would stamp every message with the server start time.
        default: Date.now
    },
});

MessageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
MessageSchema.index({ recipient: 1, sender: 1, timestamp: -1 });

const Message = mongoose.model('Message', MessageSchema);
module.exports = Message;
