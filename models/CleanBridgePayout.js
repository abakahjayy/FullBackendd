const mongoose = require("mongoose");

// A collector's request to withdraw their available balance to Mobile Money.
// Admins pay it out (manually via MoMo, recording the transaction id) or reject it.
const CleanBridgePayoutSchema = new mongoose.Schema(
    {
        collectorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeUser",
            required: true,
            index: true,
        },
        collectorName: { type: String, required: true },
        amount: { type: Number, required: true, min: 1 }, // GH₵
        momoNumber: { type: String, required: true },
        momoNetwork: { type: String, enum: ["MTN", "Telecel", "AirtelTigo"], required: true },
        status: { type: String, enum: ["requested", "paid", "rejected"], default: "requested" },
        reference: { type: String, default: null }, // MoMo transaction id
        note: { type: String, default: null },
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "CleanBridgeUser", default: null },
        processedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// At most one open request per collector - stops two concurrent requests
// from both passing the balance check.
CleanBridgePayoutSchema.index(
    { collectorId: 1 },
    { unique: true, partialFilterExpression: { status: "requested" }, name: "one_open_payout_per_collector" }
);

module.exports = mongoose.model("CleanBridgePayout", CleanBridgePayoutSchema);
