const mongoose = require("mongoose");
const Pickup = require("../models/CleanBridgePickup.js");
const Route = require("../models/CleanBridgeRoute.js");
const Vehicle = require("../models/CleanBridgeVehicle.js");
const Notification = require("../models/CleanBridgeNotification.js");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const Settings = require("../models/CleanBridgeSettings.js");
const Payout = require("../models/CleanBridgePayout.js");
const { StatusCodes } = require("http-status-codes");
const { toPickupDTO, toRouteDTO, toVehicleDTO, toUserDTO, collectorBalance, round2 } = require("../utils/cleanbridge.js");

// aggregate() doesn't cast strings to ObjectIds like find() does.
const toObjectId = (id) => mongoose.Types.ObjectId(String(id));

const OPEN = ["requested", "assigned", "on_the_way"];

const startOfDay = (d = new Date()) => {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
};
const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};

// =========================
// GET /dashboard/customer
// =========================
const getCustomerDashboard = async (req, res) => {
    const customerId = req.user.userId;

    const [nextPickup, recent, completedCount, totals, unreadNotifications] = await Promise.all([
        Pickup.findOne({ customerId, status: { $in: OPEN } }).sort({ scheduledDate: 1 }),
        Pickup.find({ customerId }).sort({ createdAt: -1 }).limit(5),
        Pickup.countDocuments({ customerId, status: "completed" }),
        Pickup.aggregate([
            { $match: { customerId: toObjectId(customerId), status: "completed" } },
            { $group: { _id: null, spent: { $sum: "$estimatedPrice" }, bags: { $sum: "$bags" } } },
        ]),
        Notification.countDocuments({ userId: customerId, read: false }),
    ]);

    return res.status(StatusCodes.OK).json({
        nextPickup: nextPickup ? toPickupDTO(nextPickup) : null,
        recentPickups: recent.map(toPickupDTO),
        completedPickups: completedCount,
        totalSpent: round2(totals[0]?.spent || 0),
        bagsCollected: totals[0]?.bags || 0,
        unreadNotifications,
    });
};

// =========================
// GET /dashboard/collector
// "earnings" = the collector's share of completed pickups (collectorEarning,
// snapshotted at completion).
// =========================
const getCollectorDashboard = async (req, res) => {
    const collectorId = toObjectId(req.user.userId);
    const today = startOfDay();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [user, vehicle, todayJobs, allTime, thisMonth, todayRoute, availableRequests, weekly, balance, monthFuel] = await Promise.all([
        CleanBridgeUser.findById(collectorId),
        Vehicle.findOne({ collectorId }),
        Pickup.find({ collectorId, status: { $in: ["assigned", "on_the_way"] } }).sort({ scheduledDate: 1 }),
        Pickup.aggregate([
            { $match: { collectorId, status: "completed" } },
            { $group: { _id: null, jobs: { $sum: 1 }, earnings: { $sum: { $ifNull: ["$collectorEarning", 0] } } } },
        ]),
        Pickup.aggregate([
            { $match: { collectorId, status: "completed", completedAt: { $gte: monthStart } } },
            { $group: { _id: null, jobs: { $sum: 1 }, earnings: { $sum: { $ifNull: ["$collectorEarning", 0] } } } },
        ]),
        Route.findOne({ collectorId, date: { $gte: today, $lt: addDays(today, 1) }, status: { $ne: "cancelled" } }).populate("stops"),
        Pickup.countDocuments({ status: "requested", collectorId: null }),
        Pickup.aggregate([
            { $match: { collectorId, status: "completed", completedAt: { $gte: addDays(today, -6) } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
                    earnings: { $sum: { $ifNull: ["$collectorEarning", 0] } },
                },
            },
        ]),
        collectorBalance(collectorId),
        Route.aggregate([
            { $match: { collectorId, date: { $gte: monthStart }, status: { $ne: "cancelled" } } },
            { $group: { _id: null, cost: { $sum: "$estimatedFuelCost" }, litres: { $sum: "$estimatedFuelLitres" } } },
        ]),
    ]);

    const weeklyByDay = Object.fromEntries(weekly.map((w) => [w._id, w.earnings]));
    const weeklyEarnings = Array.from({ length: 7 }, (_, i) => {
        const day = addDays(today, i - 6).toISOString().slice(0, 10);
        return { date: day, earnings: round2(weeklyByDay[day] || 0) };
    });

    const routeStops = todayRoute ? todayRoute.stops.length : 0;
    const routeDone = todayRoute ? todayRoute.stops.filter((s) => s.status === "completed").length : 0;

    return res.status(StatusCodes.OK).json({
        collector: toUserDTO(user),
        vehicle: vehicle ? toVehicleDTO(vehicle) : null,
        activeJobs: todayJobs.map(toPickupDTO),
        completedJobs: allTime[0]?.jobs || 0,
        totalEarnings: round2(allTime[0]?.earnings || 0),
        monthJobs: thisMonth[0]?.jobs || 0,
        monthEarnings: round2(thisMonth[0]?.earnings || 0),
        averagePerJob: allTime[0]?.jobs ? round2(allTime[0].earnings / allTime[0].jobs) : 0,
        weeklyEarnings,
        todayRoute: todayRoute ? toRouteDTO(todayRoute) : null,
        routeCompletion: routeStops ? Math.round((routeDone / routeStops) * 100) : 0,
        availableRequests,
        balance,
        monthFuelCost: round2(monthFuel[0]?.cost || 0),
        monthFuelLitres: round2(monthFuel[0]?.litres || 0),
        monthNetAfterFuel: round2((thisMonth[0]?.earnings || 0) - (monthFuel[0]?.cost || 0)),
    });
};

// =========================
// GET /dashboard/admin   (command centre)
// =========================
const getAdminDashboard = async (req, res) => {
    const today = startOfDay();
    const tomorrow = addDays(today, 1);
    const lastWeekSameDay = addDays(today, -7);

    const [pickupsToday, pickupsLastWeekSameDay, completedToday, weekCompleted, weekLate, activeCollectors, revenueToday,
        pendingVehicles, unassigned, settings, pendingPayouts] = await Promise.all([
        Pickup.countDocuments({ scheduledDate: { $gte: today, $lt: tomorrow }, status: { $ne: "cancelled" } }),
        Pickup.countDocuments({ scheduledDate: { $gte: lastWeekSameDay, $lt: addDays(lastWeekSameDay, 1) }, status: { $ne: "cancelled" } }),
        Pickup.countDocuments({ scheduledDate: { $gte: today, $lt: tomorrow }, status: "completed" }),
        // On-time rate over the last 7 days of scheduled, completed pickups.
        // "late" = completed on a later (UTC, = Accra) day than scheduled.
        Pickup.countDocuments({ scheduledDate: { $gte: addDays(today, -6), $lt: tomorrow }, status: "completed" }),
        Pickup.countDocuments({
            scheduledDate: { $gte: addDays(today, -6), $lt: tomorrow },
            status: "completed",
            $expr: { $gt: [{ $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } }, { $dateToString: { format: "%Y-%m-%d", date: "$scheduledDate" } }] },
        }),
        CleanBridgeUser.countDocuments({ role: "collector", isActive: true, collectorStatus: { $in: ["available", "on_route"] } }),
        Pickup.aggregate([
            { $match: { scheduledDate: { $gte: today, $lt: tomorrow }, status: { $ne: "cancelled" } } },
            { $group: { _id: null, total: { $sum: "$estimatedPrice" } } },
        ]),
        Vehicle.countDocuments({ verificationStatus: "pending" }),
        Pickup.find({ status: "requested", collectorId: null }).sort({ scheduledDate: 1 }).limit(10),
        Settings.getGlobal(),
        Payout.aggregate([{ $match: { status: "requested" } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } }]),
    ]);

    const change = pickupsLastWeekSameDay
        ? Math.round(((pickupsToday - pickupsLastWeekSameDay) / pickupsLastWeekSameDay) * 100)
        : null;
    const onTimeRate = weekCompleted ? Math.round(((weekCompleted - weekLate) / weekCompleted) * 100) : null;

    return res.status(StatusCodes.OK).json({
        pickupsToday,
        pickupsChangeVsLastWeekPct: change,
        completedToday,
        onTimeRate7dPct: onTimeRate,
        activeCollectors,
        revenueToday: round2(revenueToday[0]?.total || 0),
        needsAttention: {
            unassignedPickups: unassigned.map(toPickupDTO),
            vehiclesAwaitingVerification: pendingVehicles,
            payoutRequests: pendingPayouts[0]?.count || 0,
            payoutRequestsTotal: round2(pendingPayouts[0]?.total || 0),
            fuelPriceUpdatedAt: settings.fuel.effectiveDate,
        },
    });
};

// =========================
// GET /dashboard/analytics   (admin)   ?days=30
// =========================
const getAnalytics = async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = addDays(startOfDay(), -(days - 1));
    const match = { scheduledDate: { $gte: since } };

    const [byDay, byWasteType, byArea, byStatus, fuel, money] = await Promise.all([
        Pickup.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledDate" } },
                    pickups: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$estimatedPrice", 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        Pickup.aggregate([
            { $match: match },
            { $group: { _id: "$wasteType", pickups: { $sum: 1 }, bags: { $sum: "$bags" } } },
            { $sort: { pickups: -1 } },
        ]),
        Pickup.aggregate([
            { $match: match },
            { $group: { _id: "$area", pickups: { $sum: 1 }, revenue: { $sum: "$estimatedPrice" } } },
            { $sort: { pickups: -1 } },
            { $limit: 20 },
        ]),
        Pickup.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        Route.aggregate([
            { $match: { date: { $gte: since }, status: { $ne: "cancelled" } } },
            {
                $group: {
                    _id: null,
                    routes: { $sum: 1 },
                    distanceKm: { $sum: "$distanceKm" },
                    fuelLitres: { $sum: "$estimatedFuelLitres" },
                    fuelCost: { $sum: "$estimatedFuelCost" },
                },
            },
        ]),
        Pickup.aggregate([
            { $match: { ...match, status: "completed" } },
            {
                $group: {
                    _id: null,
                    gross: { $sum: "$estimatedPrice" },
                    collectors: { $sum: { $ifNull: ["$collectorEarning", 0] } },
                    platform: { $sum: { $ifNull: ["$platformFee", 0] } },
                    tax: { $sum: { $ifNull: ["$taxAmount", 0] } },
                    momo: { $sum: { $cond: [{ $eq: ["$paymentMethod", "momo"] }, 1, 0] } },
                    cash: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, 1, 0] } },
                },
            },
        ]),
    ]);

    return res.status(StatusCodes.OK).json({
        days,
        money: {
            grossRevenue: round2(money[0]?.gross || 0),
            collectorEarnings: round2(money[0]?.collectors || 0),
            platformRevenue: round2(money[0]?.platform || 0),
            taxCollected: round2(money[0]?.tax || 0),
            momoJobs: money[0]?.momo || 0,
            cashJobs: money[0]?.cash || 0,
        },
        since,
        byDay: byDay.map((d) => ({ date: d._id, pickups: d.pickups, completed: d.completed, revenue: round2(d.revenue) })),
        byWasteType: byWasteType.map((w) => ({ wasteType: w._id, pickups: w.pickups, bags: w.bags })),
        byArea: byArea.map((a) => ({ area: a._id, pickups: a.pickups, revenue: round2(a.revenue) })),
        byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
        fuel: {
            routes: fuel[0]?.routes || 0,
            distanceKm: round2(fuel[0]?.distanceKm || 0),
            fuelLitres: round2(fuel[0]?.fuelLitres || 0),
            fuelCost: round2(fuel[0]?.fuelCost || 0),
        },
    });
};

module.exports = { getCustomerDashboard, getCollectorDashboard, getAdminDashboard, getAnalytics };
