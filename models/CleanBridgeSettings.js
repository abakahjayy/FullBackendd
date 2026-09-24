const mongoose = require("mongoose");

// Singleton document (key: "global") holding the pricing rules, collector pay
// rules and current fuel price that admins edit on the Pricing / Fuel pages.
// All money is in Ghana cedis (GH₵).
const CleanBridgeSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: "global", unique: true },
        pricing: {
            baseFee: { type: Number, default: 15 },
            distanceFeePerKm: { type: Number, default: 1.5 }, // per road km from the nearest hub
            perBagFee: { type: Number, default: 5 },
            urgencyFee: { type: Number, default: 12 },
            weekendFee: { type: Number, default: 5 },
            minimumFee: { type: Number, default: 25 },
            wasteTypeFees: {
                type: Map,
                of: Number,
                default: {
                    "Household mix": 0,
                    Recyclables: 0,
                    "Organic / food waste": 2,
                    "Garden waste": 3,
                    "Bulky items": 15,
                    "E-waste": 10,
                    "Construction debris": 25,
                    "Large waste bin": 10,
                },
            },
        },
        // Extra charge for the vehicle the customer chooses (GH₵).
        vehicleFees: {
            type: Map,
            of: Number,
            default: {
                "Motor tricycle (Aboboyaa)": 0,
                "Mini truck": 10,
                "Light truck": 20,
                "Tipper truck": 45,
                "Compactor truck": 60,
            },
        },
        // Ghana taxes on the service, each charged on the pre-tax subtotal.
        // Defaults follow the VAT regime from 1 Jan 2026 (VAT 15% + NHIL 2.5%
        // + GETFund 2.5%, COVID-19 levy abolished) - confirm current GRA
        // rates, and switch off if the business is not VAT-registered.
        tax: {
            enabled: { type: Boolean, default: true },
            vatPct: { type: Number, default: 15, min: 0, max: 100 },
            nhilPct: { type: Number, default: 2.5, min: 0, max: 100 },
            getFundPct: { type: Number, default: 2.5, min: 0, max: 100 },
            covidLevyPct: { type: Number, default: 0, min: 0, max: 100 },
        },
        payouts: {
            collectorSharePct: { type: Number, default: 70, min: 0, max: 100 },
            minimumPayout: { type: Number, default: 20 },
        },
        fuel: {
            fuelType: { type: String, default: "Diesel" },
            currentPrice: { type: Number, default: 14.86 }, // GH₵ per litre
            previousPrice: { type: Number, default: 14.41 },
            effectiveDate: { type: Date, default: Date.now },
        },
    },
    { timestamps: true }
);

CleanBridgeSettingsSchema.statics.getGlobal = async function () {
    let settings = await this.findOne({ key: "global" });
    if (!settings) settings = await this.create({ key: "global" });
    return settings;
};

module.exports = mongoose.model("CleanBridgeSettings", CleanBridgeSettingsSchema);
