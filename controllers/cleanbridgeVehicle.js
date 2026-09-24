const Vehicle = require("../models/CleanBridgeVehicle.js");
const Pickup = require("../models/CleanBridgePickup.js");
const { BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { toVehicleDTO, vehicleLabel } = require("../utils/cleanbridge.js");

const EDITABLE = ["label", "type", "make", "model", "registration", "fuelType", "fuelEconomyLPer100Km", "capacityTonnes"];

// =========================
// GET /vehicles/me   (collector)
// =========================
const getMyVehicle = async (req, res) => {
    const vehicle = await Vehicle.findOne({ collectorId: req.user.userId });
    return res.status(StatusCodes.OK).json({ vehicle: vehicle ? toVehicleDTO(vehicle) : null });
};

// =========================
// PUT /vehicles/me   (collector - create or update their vehicle)
// Any edit sends the vehicle back to "pending" verification.
// =========================
const upsertMyVehicle = async (req, res) => {
    let vehicle = await Vehicle.findOne({ collectorId: req.user.userId });
    const isNew = !vehicle;
    if (isNew) vehicle = new Vehicle({ collectorId: req.user.userId });

    EDITABLE.forEach((field) => {
        if (req.body[field] !== undefined) vehicle[field] = req.body[field];
    });
    vehicle.verificationStatus = "pending";
    await vehicle.save();

    // Keep the label on the collector's open pickups in sync.
    await Pickup.updateMany(
        { collectorId: req.user.userId, status: { $in: ["assigned", "on_the_way"] } },
        { vehicleLabel: vehicleLabel(vehicle) }
    );

    return res.status(isNew ? StatusCodes.CREATED : StatusCodes.OK).json({ vehicle: toVehicleDTO(vehicle) });
};

// =========================
// GET /vehicles   (admin)   ?verificationStatus=
// =========================
const listVehicles = async (req, res) => {
    const filter = {};
    if (req.query.verificationStatus) filter.verificationStatus = req.query.verificationStatus;
    const vehicles = await Vehicle.find(filter).sort({ updatedAt: -1 });
    return res.status(StatusCodes.OK).json({ vehicles: vehicles.map(toVehicleDTO) });
};

// =========================
// PATCH /vehicles/:id/verification   (admin)   { verificationStatus }
// =========================
const setVerification = async (req, res) => {
    const { verificationStatus } = req.body;
    if (!["pending", "verified", "rejected"].includes(verificationStatus)) {
        throw new BadRequestError("verificationStatus must be pending, verified or rejected");
    }
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { verificationStatus }, { new: true, runValidators: true });
    if (!vehicle) throw new NotFoundError(`No vehicle with id: ${req.params.id}`);
    return res.status(StatusCodes.OK).json({ vehicle: toVehicleDTO(vehicle) });
};

module.exports = { getMyVehicle, upsertMyVehicle, listVehicles, setVerification };
