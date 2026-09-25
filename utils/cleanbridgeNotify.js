const Notification = require("../models/CleanBridgeNotification.js");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { sendCleanbridgeEmail, emailUrl } = require("./cleanbridgeMail.js");
const { publish } = require("./cleanbridgeEvents.js");
const { toNotificationDTO } = require("./cleanbridge.js");
const { pushToUser } = require("./push.js");

/**
 * In-app notification + email update for one CleanBridge user.
 * The email is sent in the background: a slow or failed email never delays
 * or fails the API request.
 *
 * notify(userId, title, message, { pickupId, ctaLabel, ctaPath, email = true })
 */
const notify = async (userId, title, message, { pickupId = null, ctaLabel, ctaPath, email = true, kind = "update" } = {}) => {
    const notification = await Notification.create({ userId, title, message, pickupId });
    // Instant in-app update for anyone with the app open.
    publish(userId, "notification", { ...toNotificationDTO(notification), kind });
    // Device notification (works when the app is closed).
    pushToUser(userId, {
        title,
        body: message,
        url: ctaPath || (pickupId ? `/pickups/${pickupId}` : "/notifications"),
        tag: pickupId ? `cb-pickup-${pickupId}` : undefined,
    }, { app: "cleanbridge", realm: "cleanbridge" });

    if (email) {
        setImmediate(async () => {
            const user = await CleanBridgeUser.findById(userId).select("name email emailNotifications isActive").catch(() => null);
            if (!user || !user.isActive) return;
            const path = ctaPath || (pickupId ? `/pickups/${pickupId}` : "/notifications");
            await sendCleanbridgeEmail(user, {
                title,
                message,
                cta: { label: ctaLabel || (pickupId ? "View pickup" : "Open CleanBridge"), url: emailUrl(path) },
            });
        });
    }
    return notification;
};

module.exports = { notify };
