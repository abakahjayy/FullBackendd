const SeedBridgeUser = require("../models/SeedBridgeUser.js");
const Produce = require("../models/SeedBridgeProduce.js");
const Order = require("../models/SeedBridgeOrder.js");
const LogisticsRequest = require("../models/SeedBridgeLogisticsRequest.js");
const { StatusCodes } = require('http-status-codes');

// =========================
// FARMER DASHBOARD
// GET /dashboard/farmer
// =========================
const getFarmerDashboard = async (req, res) => {
    const farmerId = req.user.userId;

    const [totalListings, activeListings, orders] = await Promise.all([
        Produce.countDocuments({ farmerId }),
        Produce.countDocuments({ farmerId, status: { $in: ['available', 'active'] } }),
        Order.find({ farmerId }),
    ]);

    const completedOrders = orders.filter(o => o.status === 'completed');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const user = await SeedBridgeUser.findById(farmerId).select('momoBalance');

    return res.status(StatusCodes.OK).json({
        totalListings,
        activeListings,
        totalRevenue,
        momoBalance: user?.momoBalance || 0,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        freshRescueCount: await Produce.countDocuments({ farmerId, freshRescue: true }),
        upcomingPickups: [], // fill in once you have a pickups/schedule model
        recentOrders: orders.slice(-5).reverse(),
        cropBreakdown: [], // aggregate by crop if/when needed
    });
};

// =========================
// BUYER DASHBOARD
// GET /dashboard/buyer
// =========================
const getBuyerDashboard = async (req, res) => {
    const buyerId = req.user.userId;

    const orders = await Order.find({ buyerId });
    const activeOrders = orders.filter(o => ['pending', 'in_transit'].includes(o.status));
    const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return res.status(StatusCodes.OK).json({
        totalOrders: orders.length,
        activeOrders: activeOrders.length,
        totalSpent,
        recentOrders: orders.slice(-5).reverse(),
        freshRescueAlerts: 0,
        favoriteRegions: [],
        savedFarmers: 0,
    });
};

// =========================
// DRIVER DASHBOARD
// GET /dashboard/driver
// =========================
const getDriverDashboard = async (req, res) => {
    const driverId = req.user.userId;

    const deliveries = await LogisticsRequest.find({ driverId });
    const activeDeliveries = deliveries.filter(d => d.status === 'in_transit');
    const completedToday = deliveries.filter(d =>
        d.status === 'completed' &&
        new Date(d.updatedAt).toDateString() === new Date().toDateString()
    );
    const totalEarnings = deliveries
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + (d.agreedFee || 0), 0);

    const user = await SeedBridgeUser.findById(driverId).select('momoBalance');

    return res.status(StatusCodes.OK).json({
        totalDeliveries: deliveries.length,
        activeDeliveries: activeDeliveries.length,
        totalEarnings,
        momoBalance: user?.momoBalance || 0,
        availableRoutes: await LogisticsRequest.countDocuments({ status: 'pending', driverId: null }),
        completedToday: completedToday.length,
        milkRunsAvailable: 0,
        backhaulSlots: 0,
        recentDeliveries: deliveries.slice(-5).reverse(),
    });
};

// =========================
// MARKET OVERVIEW (public, no auth)
// GET /dashboard/market-overview
// =========================
const getMarketOverview = async (req, res) => {
    const [activeFarmers, activeListings, totalOrdersToday, produce] = await Promise.all([
        SeedBridgeUser.countDocuments({ role: 'farmer' }),
        Produce.countDocuments({ status: { $in: ['available', 'active'] } }),
        Order.countDocuments({
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        Produce.find({ status: { $in: ['available', 'active'] } }),
    ]);

    // Group produce by crop to compute avg/min/max price per crop
    const byCrop = {};
    produce.forEach(p => {
        if (!byCrop[p.crop]) byCrop[p.crop] = [];
        byCrop[p.crop].push(p.pricePerKg);
    });
    const cropPrices = Object.entries(byCrop).map(([crop, prices]) => ({
        crop,
        avgPricePerKg: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        trend: 'stable', // needs historical data to compute properly
    }));

    // Group by region
    const byRegion = {};
    produce.forEach(p => {
        if (!byRegion[p.region]) byRegion[p.region] = { activeListings: 0, farmers: new Set() };
        byRegion[p.region].activeListings += 1;
        byRegion[p.region].farmers.add(String(p.farmerId));
    });
    const regionActivity = Object.entries(byRegion).map(([region, stats]) => ({
        region,
        activeFarmers: stats.farmers.size,
        activeListings: stats.activeListings,
        totalOrders: 0, // join with Order collection by region if you track it there
    }));

    return res.status(StatusCodes.OK).json({
        activeFarmers,
        activeListings,
        totalOrdersToday,
        freshRescueActive: await Produce.countDocuments({ freshRescue: true }),
        cropPrices,
        regionActivity,
    });
};

module.exports = {
    getFarmerDashboard,
    getBuyerDashboard,
    getDriverDashboard,
    getMarketOverview,
};
