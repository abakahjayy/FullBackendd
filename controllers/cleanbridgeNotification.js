const Notification = require("../models/CleanBridgeNotification.js");
const { NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { toNotificationDTO } = require("../utils/cleanbridge.js");

// =========================
// GET /notifications   ?unread=true
// =========================
const listNotifications = async (req, res) => {
    const filter = { userId: req.user.userId };
    if (req.query.unread === "true") filter.read = false;

    const [items, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).limit(100),
        Notification.countDocuments({ userId: req.user.userId, read: false }),
    ]);

    return res.status(StatusCodes.OK).json({ notifications: items.map(toNotificationDTO), unreadCount });
};

// =========================
// PATCH /notifications/:id/read
// =========================
const markRead = async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.userId },
        { read: true },
        { new: true }
    );
    if (!notification) throw new NotFoundError(`No notification with id: ${req.params.id}`);
    return res.status(StatusCodes.OK).json({ notification: toNotificationDTO(notification) });
};

// =========================
// PATCH /notifications/read-all
// =========================
const markAllRead = async (req, res) => {
    const result = await Notification.updateMany({ userId: req.user.userId, read: false }, { read: true });
    return res.status(StatusCodes.OK).json({ updated: result.nModified ?? result.modifiedCount ?? 0 });
};

module.exports = { listNotifications, markRead, markAllRead };
