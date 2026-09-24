const mongoose = require("mongoose");

const CleanBridgeNotificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeUser",
            required: true,
            index: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        pickupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgePickup",
            default: null,
        },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CleanBridgeNotification", CleanBridgeNotificationSchema);
