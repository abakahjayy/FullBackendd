const Settings = require("../models/CleanBridgeSettings.js");
const { WASTE_TYPES } = require("../models/CleanBridgePickup.js");
const { BadRequestError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { toSettingsDTO } = require("../utils/cleanbridge.js");

const requireNonNegative = (value, field) => {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
        throw new BadRequestError(`${field} must be a non-negative number`);
    }
};

// =========================
// GET /settings   (public - pricing rules + fuel price)
// =========================
const getSettings = async (req, res) => {
    const settings = await Settings.getGlobal();
    return res.status(StatusCodes.OK).json(toSettingsDTO(settings));
};

// =========================
// PUT /settings/pricing   (admin)   partial update
// =========================
const updatePricing = async (req, res) => {
    const settings = await Settings.getGlobal();
    const numeric = ["baseFee", "distanceFeePerKm", "perBagFee", "urgencyFee", "weekendFee", "minimumFee"];

    numeric.forEach((field) => {
        if (req.body[field] !== undefined) {
            requireNonNegative(req.body[field], field);
            settings.pricing[field] = req.body[field];
        }
    });

    if (req.body.wasteTypeFees !== undefined) {
        Object.entries(req.body.wasteTypeFees).forEach(([type, fee]) => {
            if (!WASTE_TYPES.includes(type)) {
                throw new BadRequestError(`Unknown waste type "${type}"`);
            }
            requireNonNegative(fee, `wasteTypeFees.${type}`);
            settings.pricing.wasteTypeFees.set(type, fee);
        });
    }

    await settings.save();
    return res.status(StatusCodes.OK).json(toSettingsDTO(settings));
};

// =========================
// PUT /settings/payouts   (admin)   { collectorSharePct?, minimumPayout? }
// The share applies to jobs completed after the change (earnings are
// snapshotted on each pickup at completion).
// =========================
const updatePayouts = async (req, res) => {
    const settings = await Settings.getGlobal();
    const { collectorSharePct, minimumPayout } = req.body;
    if (collectorSharePct !== undefined) {
        requireNonNegative(collectorSharePct, "collectorSharePct");
        if (collectorSharePct > 100) throw new BadRequestError("collectorSharePct cannot exceed 100");
        settings.payouts.collectorSharePct = collectorSharePct;
    }
    if (minimumPayout !== undefined) {
        requireNonNegative(minimumPayout, "minimumPayout");
        settings.payouts.minimumPayout = minimumPayout;
    }
    await settings.save();
    return res.status(StatusCodes.OK).json(toSettingsDTO(settings));
};

// =========================
// PUT /settings/fuel   (admin)   { currentPrice, fuelType?, effectiveDate? }
// The old current price becomes previousPrice.
// =========================
const updateFuel = async (req, res) => {
    const { currentPrice, fuelType, effectiveDate } = req.body;
    requireNonNegative(currentPrice, "currentPrice");

    const settings = await Settings.getGlobal();
    settings.fuel.previousPrice = settings.fuel.currentPrice;
    settings.fuel.currentPrice = currentPrice;
    if (fuelType) settings.fuel.fuelType = fuelType;
    settings.fuel.effectiveDate = effectiveDate ? new Date(effectiveDate) : new Date();

    await settings.save();
    return res.status(StatusCodes.OK).json(toSettingsDTO(settings));
};

module.exports = { getSettings, updatePricing, updatePayouts, updateFuel };
