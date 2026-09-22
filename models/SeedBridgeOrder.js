const mongoose = require("mongoose");

const SeedBridgeOrderSchema = new mongoose.Schema({
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SeedBridgeUser",
        required: true,
    },
    buyerName: { type: String, required: true },
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SeedBridgeUser",
    },
    farmerName: { type: String },
    produceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SeedBridgeProduce",
        required: true,
    },
    crop: { type: String, required: true },
    quantityKg: { type: Number, required: true },
    pricePerKg: { type: Number },
    totalAmount: { type: Number, required: true },
    depositPaid: { type: Number, default: null },
    status: {
        type: String,
        enum: ['pending', 'deposit_paid', 'confirmed', 'in_transit', 'delivered', 'completed', 'cancelled', 'disputed'],
        default: 'pending',
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'deposit_held', 'escrow_held', 'released', 'refunded'],
        default: 'unpaid',
    },
    deliveryAddress: { type: String, default: null },
    logisticsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SeedBridgeLogisticsRequest",
        default: null,
    },
    notes: { type: String, default: null },
    // --- payment tracking (Paystack) ---
    paystackReference: { type: String, default: null, index: true },
    paymentProvider: { type: String, enum: ['mtn', 'vod', 'atl', null], default: null },
    paymentGatewayResponse: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model("SeedBridgeOrder", SeedBridgeOrderSchema);
