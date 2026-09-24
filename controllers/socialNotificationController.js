const { StatusCodes } = require('http-status-codes');
const SocialNotification = require('../models/SocialNotification');
const { ACTOR_FIELDS } = require('../utils/socialNotify');

// GET /api/v1/notifications - the signed-in user's latest 50, plus the unread count.
exports.getNotifications = async (req, res) => {
    const recipient = req.user.userId;
    const [notifications, unread] = await Promise.all([
        SocialNotification.find({ recipient })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('actor', ACTOR_FIELDS)
            .populate('post', 'postId mediaType'),
        SocialNotification.countDocuments({ recipient, read: false }),
    ]);
    // Drop rows whose actor or post has since been deleted.
    const visible = notifications.filter((n) => n.actor && (n.type === 'follow' || n.post));
    res.status(StatusCodes.OK).json({ unread, notifications: visible });
};

// PATCH /api/v1/notifications/read - mark all as read.
exports.markAllRead = async (req, res) => {
    const result = await SocialNotification.updateMany(
        { recipient: req.user.userId, read: false },
        { $set: { read: true } }
    );
    res.status(StatusCodes.OK).json({ updated: result.nModified ?? result.modifiedCount ?? 0 });
};
