const mongoose = require('mongoose');

// One browser/device that allowed notifications for one app (Web Push).
// `realm` says which user collection userId belongs to: the shared User model
// (GH-GPT, Instagram, portfolio owner alerts) or CleanBridgeUser.
const pushSubscriptionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Types.ObjectId, required: true, index: true },
        realm: { type: String, enum: ['user', 'cleanbridge'], default: 'user' },
        app: { type: String, enum: ['ghgpt', 'instagram', 'cleanbridge'], required: true },
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
        userAgent: String,
        lastSuccessAt: Date,
    },
    { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
