const mongoose = require('mongoose');

// Instagram-style activity: "X liked your post", "X commented: ...", "X started following you".
// (CleanBridge has its own CleanBridgeNotification - this one is for the social app's User.)
const SocialNotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'comment', 'follow'], required: true },
    post: { type: mongoose.Types.ObjectId, ref: 'Posts' },
    text: { type: String, default: '' }, // comment preview
    read: { type: Boolean, default: false },
}, { timestamps: true });

SocialNotificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('SocialNotification', SocialNotificationSchema);
