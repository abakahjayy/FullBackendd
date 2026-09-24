const mongoose = require("mongoose");
const { VEHICLE_TYPES, VEHICLE_REG_REGEX } = require("../utils/ghana.js");

// One vehicle per collector.
const CleanBridgeVehicleSchema = new mongoose.Schema(
    {
        collectorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CleanBridgeUser",
            required: true,
            unique: true,
        },
        label: { type: String, default: null }, // fleet label, e.g. "CB 07"
        type: { type: String, enum: VEHICLE_TYPES, required: [true, "Please provide the vehicle type"] },
        make: { type: String, required: [true, "Please provide the vehicle make"] },
        model: { type: String, required: [true, "Please provide the vehicle model"] },
        registration: {
            type: String,
            required: [true, "Please provide the registration number"],
            unique: true,
            uppercase: true,
            trim: true,
            match: [VEHICLE_REG_REGEX, "Enter a Ghana DVLA plate, e.g. GR 1234-21"],
        },
        fuelType: { type: String, enum: ["Diesel", "Petrol", "Electric", "LPG"], default: "Diesel" },
        fuelEconomyLPer100Km: { type: Number, required: [true, "Please provide fuel economy (L/100km)"] },
        capacityTonnes: { type: Number, default: null },
        verificationStatus: {
            type: String,
            enum: ["pending", "verified", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CleanBridgeVehicle", CleanBridgeVehicleSchema);
