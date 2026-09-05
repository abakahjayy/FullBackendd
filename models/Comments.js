const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Posts',
        required: true
    },
    created:{
        type:Number,
        default: new Date()
    }
}, { timestamps: true });


const Comment = mongoose.model('Comment', commentSchema)
module.exports = Comment;
