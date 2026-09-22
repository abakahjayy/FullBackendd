const mongoose = require("mongoose");

const SeedBridgeProduceSchema = new mongoose.Schema({
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SeedBridgeUser",
        required: true,
    },
    farmerName: { type: String, required: true },
    farmerRating: { type: Number, default: null },
    crop: {
        type: String,
        enum: ['tomatoes', 'garden_eggs', 'okra', 'peppers', 'leafy_greens', 'other'],
        required: true,
    },
    quantityKg: { type: Number, required: true },
    availableKg: { type: Number, required: true },
    pricePerKg: { type: Number, required: true },
    originalPricePerKg: { type: Number, default: null },
    region: { type: String, required: true },
    community: { type: String, default: null },
    harvestDate: { type: Date, required: true },
    isPreHarvest: { type: Boolean, default: false },
    freshnessAlert: { type: Boolean, default: false },
    hoursToExpiry: { type: Number, default: null },
    status: {
        type: String,
        enum: ['available', 'partially_sold', 'sold_out', 'fresh_rescue', 'cancelled'],
        default: 'available',
    },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    depositRequired: { type: Number, default: null },
    pickupPoint: { type: String, default: null },
    scheduledPickupTime: { type: Date, default: null },
}, { timestamps: true });

// Mirrors the "freshRescue" flag the dashboard controller filters on.
SeedBridgeProduceSchema.virtual('freshRescue').get(function () {
    return this.status === 'fresh_rescue';
});

module.exports = mongoose.model("SeedBridgeProduce", SeedBridgeProduceSchema);
