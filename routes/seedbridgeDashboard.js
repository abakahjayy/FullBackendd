const express = require('express');
const router = express.Router();
const seedbridgeAuthMiddleware = require('../middleware/seedbridgeAuth.js');
const {
    getFarmerDashboard,
    getBuyerDashboard,
    getDriverDashboard,
    getMarketOverview,
} = require('../controllers/seedbridgeDashboard.js');

router.get('/market-overview', getMarketOverview); // public - no auth required
router.get('/farmer', seedbridgeAuthMiddleware, getFarmerDashboard);
router.get('/buyer', seedbridgeAuthMiddleware, getBuyerDashboard);
router.get('/driver', seedbridgeAuthMiddleware, getDriverDashboard);

module.exports = router;
