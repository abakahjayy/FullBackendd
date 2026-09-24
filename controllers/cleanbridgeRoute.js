const Route = require("../models/CleanBridgeRoute.js");
const Pickup = require("../models/CleanBridgePickup.js");
const Vehicle = require("../models/CleanBridgeVehicle.js");
const Settings = require("../models/CleanBridgeSettings.js");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { BadRequestError, NotFoundError, UnauthorizedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { estimateFuel, toRouteDTO } = require("../utils/cleanbridge.js");

const findVisibleRoute = async (id, user) => {
    const route = await Route.findById(id).populate("stops");
    if (!route) throw new NotFoundError(`No route with id: ${id}`);
    if (user.role !== "admin" && String(route.collectorId) !== String(user.userId)) {
        throw new UnauthorizedError("You are not authorized to access this route");
    }
    return route;
};

// =========================
// POST /routes   { date, stops: [pickupId], distanceKm, collectorId? (admin only) }
// Collectors plan routes for themselves; admins can plan for any collector.
// Fuel is estimated from the collector's vehicle economy and the current
// fuel price, and snapshotted on the route.
// =========================
const createRoute = async (req, res) => {
    const { date, stops, distanceKm } = req.body;
    const collectorId = req.user.role === "admin" ? req.body.collectorId : req.user.userId;

    if (!collectorId || !date || !Array.isArray(stops) || stops.length === 0 || distanceKm === undefined) {
        throw new BadRequestError("Please provide date, a non-empty stops array and distanceKm"
            + (req.user.role === "admin" ? ", and collectorId" : ""));
    }
    if (Number(distanceKm) < 0 || Number.isNaN(Number(distanceKm))) {
        throw new BadRequestError("distanceKm must be a non-negative number");
    }

    const collector = await CleanBridgeUser.findOne({ _id: collectorId, role: "collector" });
    if (!collector) throw new NotFoundError(`No collector with id: ${collectorId}`);

    const pickups = await Pickup.find({
        _id: { $in: stops },
        collectorId,
        status: { $in: ["assigned", "on_the_way"] },
    });
    if (pickups.length !== new Set(stops.map(String)).size) {
        throw new BadRequestError("Every stop must be an open pickup assigned to this collector");
    }

    const vehicle = await Vehicle.findOne({ collectorId });
    if (!vehicle) throw new BadRequestError("The collector needs a registered vehicle before planning a route");

    const settings = await Settings.getGlobal();
    const fuel = estimateFuel({
        distanceKm: Number(distanceKm),
        fuelEconomyLPer100Km: vehicle.fuelEconomyLPer100Km,
        fuelPricePerLitre: settings.fuel.currentPrice,
    });

    const route = await Route.create({
        collectorId,
        collectorName: collector.name,
        date: new Date(date),
        stops,
        distanceKm: Number(distanceKm),
        fuelPricePerLitre: settings.fuel.currentPrice,
        ...fuel,
    });

    await Pickup.updateMany({ _id: { $in: stops } }, { routeId: route._id });
    await route.populate("stops").execPopulate();

    return res.status(StatusCodes.CREATED).json({ route: toRouteDTO(route) });
};

// =========================
// GET /routes   collector -> own, admin -> all   ?status=&date=YYYY-MM-DD
// =========================
const listRoutes = async (req, res) => {
    const filter = {};
    if (req.user.role !== "admin") filter.collectorId = req.user.userId;
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.date) {
        const start = new Date(req.query.date);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        filter.date = { $gte: start, $lt: end };
    }

    const routes = await Route.find(filter).sort({ date: -1 }).limit(100);
    return res.status(StatusCodes.OK).json({ routes: routes.map(toRouteDTO) });
};

// =========================
// GET /routes/today   (collector - today's route with stops, or null)
// =========================
const getTodayRoute = async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const route = await Route.findOne({
        collectorId: req.user.userId,
        date: { $gte: start, $lt: end },
        status: { $ne: "cancelled" },
    }).populate("stops");

    return res.status(StatusCodes.OK).json({ route: route ? toRouteDTO(route) : null });
};

// =========================
// GET /routes/:id
// =========================
const getRoute = async (req, res) => {
    const route = await findVisibleRoute(req.params.id, req.user);
    return res.status(StatusCodes.OK).json({ route: toRouteDTO(route) });
};

// =========================
// PATCH /routes/:id/status   { status: in_progress | completed | cancelled }
// =========================
const ROUTE_TRANSITIONS = {
    planned: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
};

const updateRouteStatus = async (req, res) => {
    const { status } = req.body;
    const route = await findVisibleRoute(req.params.id, req.user);

    if (!ROUTE_TRANSITIONS[route.status].includes(status)) {
        throw new BadRequestError(`Cannot move a route from "${route.status}" to "${status}"`);
    }

    route.status = status;
    if (status === "in_progress") route.startedAt = new Date();
    if (status === "completed") route.completedAt = new Date();
    await route.save();

    const collectorStatus = status === "in_progress" ? "on_route" : "available";
    await CleanBridgeUser.updateOne({ _id: route.collectorId }, { collectorStatus });
    if (status === "cancelled") {
        await Pickup.updateMany({ routeId: route._id, status: { $ne: "completed" } }, { routeId: null });
    }

    return res.status(StatusCodes.OK).json({ route: toRouteDTO(route) });
};

module.exports = { createRoute, listRoutes, getTodayRoute, getRoute, updateRouteStatus };
