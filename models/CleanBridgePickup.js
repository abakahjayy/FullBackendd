const mongoose = require("mongoose");
const { nextSequence } = require("../utils/cleanbridge.js");
const { WASTE_TYPES } = require("../utils/ghana.js");

const PICKUP_STATUSES = ["requested", "assigned", "on_the_way", "completed", "cancelled"];

const CleanBridgePickupSchema = new mongoose.Schema(
    {
        // Human-friendly id shown in the UI, e.g. "CB-1048".
        code: { type: String, unique: true, index: true },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeUser",
            required: true,
        },
        customerName: { type: String, required: true },
        customerPhone: { type: String, default: null },
        area: { type: String, required: [true, "Please provide the pickup area"] },
        address: { type: String, required: [true, "Please provide the pickup address"] },
        region: { type: String, default: null },
        ghanaPostGps: { type: String, default: null },
        location: {
            lat: { type: Number, required: [true, "Please pick the pickup location on the map"] },
            lng: { type: Number, required: [true, "Please pick the pickup location on the map"] },
        },
        hubId: { type: String, default: null },
        hubName: { type: String, default: null },
        gateNote: { type: String, default: null },
        wasteType: { type: String, enum: WASTE_TYPES, required: true },
        bags: { type: Number, required: true, min: 1 },
        scheduledDate: { type: Date, required: true },
        timeWindow: { type: String, required: true }, // e.g. "08:00 – 10:00"
        urgent: { type: Boolean, default: false },
        distanceKm: { type: Number, default: 0 }, // road km from nearest hub
        estimatedPrice: { type: Number, required: true }, // GH₵
        priceBreakdown: { type: Object, default: null },
        // --- payment ---
        paymentMethod: { type: String, enum: ["cash", "momo"], default: "cash" },
        paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
        // true when the collector took cash at the gate (they hold the money)
        cashCollected: { type: Boolean, default: false },
        paystackReference: { type: String, default: null, index: true },
        // Paystack channel actually used (mobile_money, card, bank_transfer, ussd, qr, apple_pay...)
        paymentChannel: { type: String, default: null },
        paymentChannelLabel: { type: String, default: null },
        paidAt: { type: Date, default: null },
        // --- earnings snapshot, set on completion ---
        collectorEarning: { type: Number, default: null },
        platformFee: { type: Number, default: null },
        // --- assignment / progress ---
        status: { type: String, enum: PICKUP_STATUSES, default: "requested" },
        collectorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeUser",
            default: null,
        },
        collectorName: { type: String, default: null },
        collectorPhone: { type: String, default: null },
        vehicleLabel: { type: String, default: null },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeRoute",
            default: null,
        },
        etaMinutes: { type: Number, default: null },
        customerRating: { type: Number, min: 1, max: 5, default: null },
        assignedAt: { type: Date, default: null },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
    },
    { timestamps: true }
);

CleanBridgePickupSchema.pre("save", async function (next) {
    if (!this.code) {
        const seq = await nextSequence("pickup");
        this.code = `CB-${1000 + seq}`;
    }
    next();
});

module.exports = mongoose.model("CleanBridgePickup", CleanBridgePickupSchema);
module.exports.WASTE_TYPES = WASTE_TYPES;
module.exports.PICKUP_STATUSES = PICKUP_STATUSES;
