const Produce = require("../models/SeedBridgeProduce.js");
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

// Shapes a Mongoose Produce doc into the API's Produce schema (id, not _id).
const toProduceDTO = (doc) => {
    const obj = doc.toObject({ virtuals: true });
    return {
        id: obj._id.toString(),
        farmerId: obj.farmerId?.toString(),
        farmerName: obj.farmerName,
        farmerRating: obj.farmerRating,
        crop: obj.crop,
        quantityKg: obj.quantityKg,
        availableKg: obj.availableKg,
        pricePerKg: obj.pricePerKg,
        originalPricePerKg: obj.originalPricePerKg,
        region: obj.region,
        community: obj.community,
        harvestDate: obj.harvestDate,
        isPreHarvest: obj.isPreHarvest,
        freshnessAlert: obj.freshnessAlert,
        hoursToExpiry: obj.hoursToExpiry,
        status: obj.status,
        description: obj.description,
        imageUrl: obj.imageUrl,
        depositRequired: obj.depositRequired,
        pickupPoint: obj.pickupPoint,
        scheduledPickupTime: obj.scheduledPickupTime,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
};

// =========================
// GET /produce
// =========================
const listProduce = async (req, res) => {
    const {
        crop, region, status, minPrice, maxPrice,
        freshnessAlert, farmerId, page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (crop) filter.crop = crop;
    if (region) filter.region = region;
    if (status === 'available') {
        // "Available" from the marketplace's point of view means "still has
        // stock", which includes partially_sold listings - not just ones
        // that have never been touched. Only sold_out/cancelled/fresh_rescue
        // etc. should actually disappear.
        filter.status = { $in: ['available', 'partially_sold'] };
    } else if (status) {
        filter.status = status;
    }
    if (farmerId) filter.farmerId = farmerId;
    if (freshnessAlert !== undefined) filter.freshnessAlert = freshnessAlert === 'true';
    if (minPrice || maxPrice) {
        filter.pricePerKg = {};
        if (minPrice) filter.pricePerKg.$gte = Number(minPrice);
        if (maxPrice) filter.pricePerKg.$lte = Number(maxPrice);
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;

    const [items, total] = await Promise.all([
        Produce.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
        Produce.countDocuments(filter),
    ]);

    return res.status(StatusCodes.OK).json({
        items: items.map(toProduceDTO),
        total,
        page: pageNum,
        limit: limitNum,
    });
};

// =========================
// GET /produce/fresh-rescue
// =========================
const listFreshRescue = async (req, res) => {
    const { crop, region } = req.query;
    const filter = { status: 'fresh_rescue' };
    if (crop) filter.crop = crop;
    if (region) filter.region = region;

    const items = await Produce.find(filter).sort({ createdAt: -1 });
    return res.status(StatusCodes.OK).json(items.map(toProduceDTO));
};

// =========================
// GET /produce/pre-harvest
// =========================
const listPreHarvest = async (req, res) => {
    const { crop, region, harvestBefore } = req.query;
    const filter = { isPreHarvest: true };
    if (crop) filter.crop = crop;
    if (region) filter.region = region;
    if (harvestBefore) filter.harvestDate = { $lte: new Date(harvestBefore) };

    const items = await Produce.find(filter).sort({ harvestDate: 1 });
    return res.status(StatusCodes.OK).json(items.map(toProduceDTO));
};

// =========================
// GET /produce/:id
// =========================
const getProduce = async (req, res) => {
    const { id } = req.params;
    const produce = await Produce.findById(id);

    if (!produce) {
        throw new NotFoundError(`No produce listing with id: ${id}`);
    }

    return res.status(StatusCodes.OK).json(toProduceDTO(produce));
};

// =========================
// POST /produce
// =========================
const createProduce = async (req, res) => {
    const {
        crop, quantityKg, pricePerKg, region, harvestDate,
        community, isPreHarvest, description, imageUrl,
        depositRequired, pickupPoint, scheduledPickupTime,
    } = req.body;

    if (!crop || !quantityKg || !pricePerKg || !region || !harvestDate) {
        throw new BadRequestError('Please provide crop, quantityKg, pricePerKg, region and harvestDate');
    }

    // farmerId/farmerName come from the authenticated user, not the request body.
    const farmerId = req.user.userId;
    const farmerName = req.user.name || req.user.username;

    const produce = await Produce.create({
        farmerId,
        farmerName,
        crop,
        quantityKg,
        availableKg: quantityKg,
        pricePerKg,
        region,
        community,
        harvestDate,
        isPreHarvest: !!isPreHarvest,
        description,
        imageUrl,
        depositRequired,
        pickupPoint,
        scheduledPickupTime,
        status: 'available',
    });

    return res.status(StatusCodes.CREATED).json(toProduceDTO(produce));
};

// =========================
// PATCH /produce/:id
// =========================
const updateProduce = async (req, res) => {
    const { id } = req.params;
    const {
        quantityKg, pricePerKg, status, description,
        imageUrl, scheduledPickupTime, harvestDate,
    } = req.body;

    const produce = await Produce.findById(id);

    if (!produce) {
        throw new NotFoundError(`No produce listing with id: ${id}`);
    }

    // Only the owning farmer can update their own listing.
    if (String(produce.farmerId) !== String(req.user.userId)) {
        throw new UnauthenticatedError('You are not authorized to update this listing');
    }

    if (quantityKg !== undefined) produce.quantityKg = quantityKg;
    if (pricePerKg !== undefined) produce.pricePerKg = pricePerKg;
    if (status !== undefined) produce.status = status;
    if (description !== undefined) produce.description = description;
    if (imageUrl !== undefined) produce.imageUrl = imageUrl;
    if (scheduledPickupTime !== undefined) produce.scheduledPickupTime = scheduledPickupTime;
    if (harvestDate !== undefined) produce.harvestDate = harvestDate;

    await produce.save();

    return res.status(StatusCodes.OK).json(toProduceDTO(produce));
};

// =========================
// DELETE /produce/:id
// =========================
const deleteProduce = async (req, res) => {
    const { id } = req.params;
    const produce = await Produce.findById(id);

    if (!produce) {
        throw new NotFoundError(`No produce listing with id: ${id}`);
    }

    if (String(produce.farmerId) !== String(req.user.userId)) {
        throw new UnauthenticatedError('You are not authorized to delete this listing');
    }

    await produce.deleteOne();

    return res.status(StatusCodes.OK).json({ success: true });
};

module.exports = {
    listProduce,
    listFreshRescue,
    listPreHarvest,
    getProduce,
    createProduce,
    updateProduce,
    deleteProduce,
};
