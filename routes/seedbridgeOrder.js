const express = require('express');
const router = express.Router();
const seedbridgeAuthMiddleware = require('../middleware/seedbridgeAuth.js');
const {
    listOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
} = require('../controllers/seedbridgeOrder.js');

router.get('/', seedbridgeAuthMiddleware, listOrders);
router.get('/:id', seedbridgeAuthMiddleware, getOrder);
router.post('/', seedbridgeAuthMiddleware, createOrder);
router.patch('/:id/status', seedbridgeAuthMiddleware, updateOrderStatus);

module.exports = router;
