const Pickup = require("../models/CleanBridgePickup.js");
const { WASTE_TYPES } = require("../models/CleanBridgePickup.js");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const Vehicle = require("../models/CleanBridgeVehicle.js");
const Settings = require("../models/CleanBridgeSettings.js");
const { notify } = require("../utils/cleanbridgeNotify.js");
const { BadRequestError, NotFoundError, UnauthorizedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { quotePickup, toPickupDTO, vehicleLabel, round2 } = require("../utils/cleanbridge.js");
const { serviceInfo, haversineKm, ROAD_FACTOR, normalizeGhanaPostGps } = require("../utils/ghana.js");

// Average urban speed for a loaded collection vehicle in Ghanaian traffic.
const AVG_SPEED_KMH = 22;
const LIVE_LOCATION_MAX_AGE_MS = 10 * 60 * 1000;


const validatePickupInput = ({ wasteType, bags, scheduledDate }) => {
    if (!WASTE_TYPES.includes(wasteType)) {
        throw new BadRequestError(`wasteType must be one of: ${WASTE_TYPES.join(", ")}`);
    }
    if (!Number.isInteger(Number(bags)) || Number(bags) < 1 || Number(bags) > 50) {
        throw new BadRequestError("Quantity must be a whole number from 1 to 50");
    }
    if (!scheduledDate || Number.isNaN(new Date(scheduledDate).getTime())) {
        throw new BadRequestError("Please provide a valid scheduledDate");
    }
};

// Resolves the pickup point to a serviceable hub + road distance, or throws.
const resolveService = (location) => {
    if (!location || location.lat === undefined || location.lng === undefined) {
        throw new BadRequestError("Please choose the pickup location");
    }
    const info = serviceInfo(location.lat, location.lng);
    if (!info.serviceable) throw new BadRequestError(info.reason);
    return info;
};

// Who may see a single pickup: its customer, its assigned collector, any
// admin, and any collector while it is still unassigned (so they can decide
// whether to accept it).
const canView = (pickup, user) => {
    const uid = String(user.userId);
    if (user.role === "admin") return true;
    if (String(pickup.customerId) === uid) return true;
    if (user.role === "collector") {
        return String(pickup.collectorId) === uid || (!pickup.collectorId && pickup.status === "requested");
    }
    return false;
};

const findPickupOr404 = async (id) => {
    const pickup = await Pickup.findById(id);
    if (!pickup) throw new NotFoundError(`No pickup with id: ${id}`);
    return pickup;
};

const liveLocationOf = (collector) => {
    const loc = collector?.lastLocation;
    if (!loc?.lat || !loc.updatedAt || Date.now() - new Date(loc.updatedAt).getTime() > LIVE_LOCATION_MAX_AGE_MS) {
        return null;
    }
    return { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt };
};

const etaMinutesBetween = (from, to) =>
    Math.max(2, Math.round((haversineKm(from, to) * ROAD_FACTOR / AVG_SPEED_KMH) * 60));

// =========================
// POST /pickups/quote   (public - price preview on the request form)
// { wasteType, bags, scheduledDate, urgent, location: { lat, lng } }
// =========================
const getQuote = async (req, res) => {
    validatePickupInput(req.body);
    const service = resolveService(req.body.location);
    const settings = await Settings.getGlobal();
    return res.status(StatusCodes.OK).json({
        ...quotePickup(settings.pricing, { ...req.body, distanceKm: service.distanceKm }),
        hub: service.hub,
    });
};

// =========================
// POST /pickups   (customer)
// =========================
const createPickup = async (req, res) => {
    const {
        area, address, gateNote, wasteType, bags, scheduledDate, timeWindow, urgent,
        location, region, ghanaPostGps, paymentMethod = "cash",
    } = req.body;

    if (!address || !timeWindow) {
        throw new BadRequestError("Please provide the address and a time window");
    }
    if (!["cash", "momo"].includes(paymentMethod)) {
        throw new BadRequestError("paymentMethod must be cash or momo");
    }
    validatePickupInput(req.body);
    const service = resolveService(location);

    const gps = normalizeGhanaPostGps(ghanaPostGps);
    if (gps === undefined) throw new BadRequestError("GhanaPost GPS address looks like GA-183-8164");

    const scheduled = new Date(scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (scheduled < today) {
        throw new BadRequestError("The pickup date cannot be in the past");
    }

    const customer = await CleanBridgeUser.findById(req.user.userId);
    if (!customer.phone) {
        throw new BadRequestError("Add your phone number to your profile so your collector can reach you");
    }
    const settings = await Settings.getGlobal();
    // Price is always computed server-side - never trusted from the client.
    const quote = quotePickup(settings.pricing, { wasteType, bags, distanceKm: service.distanceKm, urgent, scheduledDate });

    const pickup = await Pickup.create({
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        area: area || service.hub.name,
        address,
        region: region || service.hub.region,
        ghanaPostGps: gps,
        location: { lat: Number(location.lat), lng: Number(location.lng) },
        hubId: service.hub.id,
        hubName: service.hub.name,
        gateNote,
        wasteType,
        bags: Number(bags),
        scheduledDate: scheduled,
        timeWindow,
        urgent: Boolean(urgent),
        distanceKm: service.distanceKm,
        estimatedPrice: quote.total,
        priceBreakdown: quote.breakdown,
        paymentMethod,
    });

    // Remember this as their usual address if they don't have one yet.
    if (!customer.location) {
        customer.location = pickup.location;
        customer.address = customer.address || address;
        customer.area = customer.area || pickup.area;
        await customer.save();
    }

    await notify(customer._id, "Pickup requested",
        `Your ${wasteType.toLowerCase()} pickup ${pickup.code} is booked for ${timeWindow}.`, { pickupId: pickup._id });

    return res.status(StatusCodes.CREATED).json({ pickup: toPickupDTO(pickup), quote });
};

// =========================
// GET /pickups   (role-aware list)
// customer -> own pickups, collector -> assigned to them, admin -> all
// query: status, area, q, from, to, limit, page
// =========================
const listPickups = async (req, res) => {
    const { status, area, from, to, q } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const filter = {};
    if (req.user.role === "customer") filter.customerId = req.user.userId;
    if (req.user.role === "collector") filter.collectorId = req.user.userId;
    if (status) filter.status = { $in: String(status).split(",") };
    if (area) filter.area = area;
    if (q) {
        const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ code: rx }, { customerName: rx }, { area: rx }, { address: rx }, { collectorName: rx }];
    }
    if (from || to) {
        filter.scheduledDate = {};
        if (from) filter.scheduledDate.$gte = new Date(from);
        if (to) filter.scheduledDate.$lte = new Date(to);
    }

    const [items, total] = await Promise.all([
        Pickup.find(filter).sort({ scheduledDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Pickup.countDocuments(filter),
    ]);

    return res.status(StatusCodes.OK).json({ pickups: items.map(toPickupDTO), total, page, limit });
};

// =========================
// GET /pickups/available   (collector - unassigned requests, nearest first
// when ?lat=&lng= is given)
// =========================
const listAvailablePickups = async (req, res) => {
    const filter = { status: "requested", collectorId: null };
    if (req.query.area) filter.area = req.query.area;

    const pickups = await Pickup.find(filter).sort({ urgent: -1, scheduledDate: 1 }).limit(100);
    const settings = await Settings.getGlobal();
    const share = (settings.payouts?.collectorSharePct ?? 70) / 100;

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const here = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

    const result = pickups.map((p) => ({
        ...toPickupDTO(p),
        estimatedEarning: round2(p.estimatedPrice * share),
        distanceFromYouKm: here && p.location?.lat != null
            ? Math.round(haversineKm(here, p.location) * ROAD_FACTOR * 10) / 10 : null,
    }));
    if (here) result.sort((a, b) => (a.distanceFromYouKm ?? 1e9) - (b.distanceFromYouKm ?? 1e9));

    return res.status(StatusCodes.OK).json({ pickups: result.slice(0, 50) });
};

// =========================
// GET /pickups/:id   (+ the collector's live position while it's active)
// =========================
const getPickup = async (req, res) => {
    const pickup = await findPickupOr404(req.params.id);
    if (!canView(pickup, req.user)) {
        throw new UnauthorizedError("You are not authorized to view this pickup");
    }

    let collectorLocation = null;
    let liveEtaMinutes = null;
    if (pickup.collectorId && ["assigned", "on_the_way"].includes(pickup.status)) {
        const collector = await CleanBridgeUser.findById(pickup.collectorId).select("lastLocation");
        collectorLocation = liveLocationOf(collector);
        if (collectorLocation && pickup.status === "on_the_way") {
            liveEtaMinutes = etaMinutesBetween(collectorLocation, pickup.location);
        }
    }

    return res.status(StatusCodes.OK).json({ pickup: toPickupDTO(pickup), collectorLocation, liveEtaMinutes });
};

const assignTo = async (pickupId, collector, extraFilter = {}) => {
    const vehicle = await Vehicle.findOne({ collectorId: collector._id });
    return Pickup.findOneAndUpdate(
        { _id: pickupId, status: { $in: ["requested", "assigned"] }, ...extraFilter },
        {
            collectorId: collector._id,
            collectorName: collector.name,
            collectorPhone: collector.phone || null,
            vehicleLabel: vehicleLabel(vehicle),
            status: "assigned",
            assignedAt: new Date(),
        },
        { new: true }
    );
};

const requireReadyCollector = async (collectorId) => {
    const vehicle = await Vehicle.findOne({ collectorId });
    if (!vehicle || vehicle.verificationStatus !== "verified") {
        throw new BadRequestError("A verified vehicle is required before taking jobs. Register it on the Vehicle page.");
    }
};

// =========================
// PATCH /pickups/:id/accept   (collector claims an unassigned request)
// =========================
const acceptPickup = async (req, res) => {
    const collector = await CleanBridgeUser.findById(req.user.userId);
    await requireReadyCollector(collector._id);
    // Atomic: only succeeds if nobody else has claimed it in the meantime.
    const pickup = await assignTo(req.params.id, collector, { status: "requested", collectorId: null });
    if (!pickup) {
        throw new BadRequestError("This pickup is no longer available");
    }
    if (collector.collectorStatus === "off_duty") {
        collector.collectorStatus = "available";
        await collector.save();
    }

    await notify(pickup.customerId, "Collector assigned",
        `${collector.name} will handle your pickup ${pickup.code}.`, { pickupId: pickup._id });

    return res.status(StatusCodes.OK).json({ pickup: toPickupDTO(pickup) });
};

// =========================
// PATCH /pickups/:id/assign   (admin)   { collectorId }
// =========================
const assignPickup = async (req, res) => {
    const { collectorId } = req.body;
    if (!collectorId) throw new BadRequestError("Please provide collectorId");

    const collector = await CleanBridgeUser.findOne({ _id: collectorId, role: "collector", isActive: true });
    if (!collector) throw new NotFoundError(`No active collector with id: ${collectorId}`);
    await requireReadyCollector(collector._id);

    const pickup = await assignTo(req.params.id, collector);
    if (!pickup) {
        throw new BadRequestError("Pickup not found, or it is already on the way, completed or cancelled");
    }

    await Promise.all([
        notify(pickup.customerId, "Collector assigned", `${collector.name} will handle your pickup ${pickup.code}.`, { pickupId: pickup._id }),
        notify(collector._id, "New job assigned", `Pickup ${pickup.code} in ${pickup.area} (${pickup.timeWindow}) was assigned to you.`, { pickupId: pickup._id }),
    ]);

    return res.status(StatusCodes.OK).json({ pickup: toPickupDTO(pickup) });
};

// =========================
// PATCH /pickups/:id/status   { status, etaMinutes?, cashCollected? }
// collector (assigned): assigned -> on_the_way -> completed
// customer (owner):     requested/assigned -> cancelled
// admin:                any valid transition
// =========================
const TRANSITIONS = {
    requested: ["assigned", "cancelled"],
    assigned: ["on_the_way", "cancelled"],
    on_the_way: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
};

const updatePickupStatus = async (req, res) => {
    const { status, etaMinutes } = req.body;
    const pickup = await findPickupOr404(req.params.id);
    const uid = String(req.user.userId);
    const { role } = req.user;

    if (!TRANSITIONS[pickup.status].includes(status)) {
        throw new BadRequestError(`Cannot move a pickup from "${pickup.status}" to "${status}"`);
    }
    if (status === "assigned") {
        throw new BadRequestError("Use /accept or /assign to assign a collector");
    }

    const isOwner = String(pickup.customerId) === uid;
    const isAssignedCollector = role === "collector" && String(pickup.collectorId) === uid;

    if (role !== "admin") {
        if (status === "cancelled" && !(isOwner && ["requested", "assigned"].includes(pickup.status))) {
            throw new UnauthorizedError("Only the customer can cancel, and only before the collector sets off");
        }
        if (["on_the_way", "completed"].includes(status) && !isAssignedCollector) {
            throw new UnauthorizedError("Only the assigned collector can update this pickup");
        }
    }

    pickup.status = status;

    if (status === "on_the_way") {
        pickup.startedAt = new Date();
        if (etaMinutes !== undefined) {
            pickup.etaMinutes = Number(etaMinutes);
        } else {
            const collector = await CleanBridgeUser.findById(pickup.collectorId).select("lastLocation");
            const here = liveLocationOf(collector);
            pickup.etaMinutes = here ? etaMinutesBetween(here, pickup.location) : null;
        }
        await CleanBridgeUser.updateOne({ _id: pickup.collectorId }, { collectorStatus: "on_route" });
    }

    if (status === "completed") {
        const settings = await Settings.getGlobal();
        const sharePct = settings.payouts?.collectorSharePct ?? 70;
        pickup.completedAt = new Date();
        pickup.collectorEarning = round2(pickup.estimatedPrice * sharePct / 100);
        pickup.platformFee = round2(pickup.estimatedPrice - pickup.collectorEarning);
        // Cash jobs: the collector takes the money at the gate.
        if (pickup.paymentMethod === "cash" && pickup.paymentStatus === "unpaid") {
            pickup.cashCollected = true;
            pickup.paymentStatus = "paid";
            pickup.paidAt = new Date();
        }
    }

    if (status === "cancelled") pickup.cancelledAt = new Date();
    await pickup.save();

    const messages = {
        on_the_way: ["Your collector is on the way",
            `${pickup.collectorName} is heading to ${pickup.area}${pickup.etaMinutes ? ` - about ${pickup.etaMinutes} min away` : ""}.`],
        completed: ["Pickup completed",
            `Your pickup ${pickup.code} was completed. Thank you for keeping Ghana clean!`],
        cancelled: ["Pickup cancelled",
            `Pickup ${pickup.code} has been cancelled.${pickup.paymentStatus === "paid" ? " Your Mobile Money payment will be refunded." : ""}`],
    };
    const [title, message] = messages[status];
    await notify(pickup.customerId, title, message, { pickupId: pickup._id });
    if (status === "cancelled" && pickup.collectorId && !isAssignedCollector) {
        await notify(pickup.collectorId, title, message, { pickupId: pickup._id });
    }

    return res.status(StatusCodes.OK).json({ pickup: toPickupDTO(pickup) });
};

// =========================
// POST /pickups/:id/rate   (customer, once, after completion)   { rating: 1-5 }
// =========================
const ratePickup = async (req, res) => {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new BadRequestError("rating must be a whole number from 1 to 5");
    }

    // Atomic guard against rating the same pickup twice.
    const pickup = await Pickup.findOneAndUpdate(
        { _id: req.params.id, customerId: req.user.userId, status: "completed", customerRating: null },
        { customerRating: rating },
        { new: true }
    );
    if (!pickup) {
        throw new BadRequestError("Only your own completed, not-yet-rated pickups can be rated");
    }

    // Recomputed from source rather than incremented, so two ratings landing
    // at once can't overwrite each other's contribution.
    if (pickup.collectorId) {
        const [agg] = await Pickup.aggregate([
            { $match: { collectorId: pickup.collectorId, customerRating: { $ne: null } } },
            { $group: { _id: null, avg: { $avg: "$customerRating" }, count: { $sum: 1 } } },
        ]);
        await CleanBridgeUser.updateOne(
            { _id: pickup.collectorId },
            { rating: round2(agg.avg), ratingCount: agg.count }
        );
    }

    return res.status(StatusCodes.OK).json({ pickup: toPickupDTO(pickup) });
};

// =========================
// PATCH /pickups/:id/refund   (admin - record that a MoMo payment was refunded)
// =========================
const markRefunded = async (req, res) => {
    const pickup = await Pickup.findOneAndUpdate(
        { _id: req.params.id, paymentStatus: "paid", cashCollected: false },
        { paymentStatus: "refunded" },
        { new: true }
    );
    if (!pickup) throw new BadRequestError("Only Mobile Money-paid pickups can be marked refunded");
    await notify(pickup.customerId, "Refund processed", `Your payment for ${pickup.code} has been refunded.`, { pickupId: pickup._id });
    return res.status(StatusCodes.OK).json({ pickup: toPickupDTO(pickup) });
};

module.exports = {
    getQuote,
    createPickup,
    listPickups,
    listAvailablePickups,
    getPickup,
    acceptPickup,
    assignPickup,
    updatePickupStatus,
    ratePickup,
    markRefunded,
};
