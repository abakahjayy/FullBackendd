const mongoose = require("mongoose");
const { nextSequence } = require("../utils/cleanbridge.js");

const CleanBridgeRouteSchema = new mongoose.Schema(
    {
        code: { type: String, unique: true, index: true }, // e.g. "RT-0624"
        collectorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeUser",
            required: true,
        },
        collectorName: { type: String, required: true },
        date: { type: Date, required: true },
        // Ordered list of stops.
        stops: [{ type: mongoose.Schema.Types.ObjectId, ref: "CleanBridgePickup" }],
        distanceKm: { type: Number, required: true, min: 0 },
        // Snapshotted at creation so historical fuel costs don't change when
        // the fuel price is updated later.
        fuelPricePerLitre: { type: Number, required: true },
        estimatedFuelLitres: { type: Number, required: true },
        estimatedFuelCost: { type: Number, required: true },
        status: {
            type: String,
            enum: ["planned", "in_progress", "completed", "cancelled"],
            default: "planned",
        },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

CleanBridgeRouteSchema.pre("save", async function (next) {
    if (!this.code) {
        const seq = await nextSequence("route");
        this.code = `RT-${String(seq).padStart(4, "0")}`;
    }
    next();
});

module.exports = mongoose.model("CleanBridgeRoute", CleanBridgeRouteSchema);
