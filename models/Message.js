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
        default: Date.now()
    },
});

const Message = mongoose.model('Message', MessageSchema);
module.exports = Message;
