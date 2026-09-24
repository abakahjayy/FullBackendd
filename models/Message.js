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
    message: {
        type: String,
        required: [true, 'Please Provide the Message']
    },
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
