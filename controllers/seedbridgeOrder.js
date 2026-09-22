const Order = require("../models/SeedBridgeOrder.js");
const Produce = require("../models/SeedBridgeProduce.js");
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const toOrderDTO = (doc) => {
    const obj = doc.toObject();
    return {
        id: obj._id.toString(),
        buyerId: obj.buyerId?.toString(),
        buyerName: obj.buyerName,
        farmerId: obj.farmerId?.toString(),
        farmerName: obj.farmerName,
        produceId: obj.produceId?.toString(),
        crop: obj.crop,
        quantityKg: obj.quantityKg,
        pricePerKg: obj.pricePerKg,
        totalAmount: obj.totalAmount,
        depositPaid: obj.depositPaid,
        status: obj.status,
        paymentStatus: obj.paymentStatus,
        deliveryAddress: obj.deliveryAddress,
        logisticsId: obj.logisticsId?.toString() || null,
        notes: obj.notes,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
};

// =========================
// GET /orders  (for the current logged-in user)
// =========================
const listOrders = async (req, res) => {
    const { status, role } = req.query;
    const userId = req.user.userId;

    const filter = {};
    if (status) filter.status = status;

    // "role" tells us which side of the order the current user sits on.
    if (role === 'farmer') {
        filter.farmerId = userId;
    } else if (role === 'buyer') {
        filter.buyerId = userId;
    } else {
        filter.$or = [{ buyerId: userId }, { farmerId: userId }];
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.status(StatusCodes.OK).json(orders.map(toOrderDTO));
};

// =========================
// GET /orders/:id
// =========================
const getOrder = async (req, res) => {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
        throw new NotFoundError(`No order with id: ${id}`);
    }

    const userId = String(req.user.userId);
    if (String(order.buyerId) !== userId && String(order.farmerId) !== userId) {
        throw new UnauthenticatedError('You are not authorized to view this order');
    }

    return res.status(StatusCodes.OK).json(toOrderDTO(order));
};

// =========================
// POST /orders
// =========================
const createOrder = async (req, res) => {
    const { produceId, quantityKg, deliveryAddress, isDeposit, notes } = req.body;

    if (!produceId || !quantityKg || !deliveryAddress) {
        throw new BadRequestError('Please provide produceId, quantityKg and deliveryAddress');
    }

    const produce = await Produce.findById(produceId);
    if (!produce) {
        throw new NotFoundError(`No produce listing with id: ${produceId}`);
    }

    if (produce.availableKg < quantityKg) {
        throw new BadRequestError(`Only ${produce.availableKg}kg available for this listing`);
    }

    const buyerId = req.user.userId;
    const buyerName = req.user.name || req.user.username;
    const totalAmount = quantityKg * produce.pricePerKg;
    const depositPaid = isDeposit ? produce.depositRequired || 0 : null;

    const order = await Order.create({
        buyerId,
        buyerName,
        farmerId: produce.farmerId,
        farmerName: produce.farmerName,
        produceId,
        crop: produce.crop,
        quantityKg,
        pricePerKg: produce.pricePerKg,
        totalAmount,
        depositPaid,
        deliveryAddress,
        notes,
        status: isDeposit ? 'deposit_paid' : 'pending',
        paymentStatus: isDeposit ? 'deposit_held' : 'unpaid',
    });

    // Reduce available stock and flip status once fully sold out.
    produce.availableKg -= quantityKg;
    if (produce.availableKg <= 0) {
        produce.status = 'sold_out';
    } else if (produce.availableKg < produce.quantityKg) {
        produce.status = 'partially_sold';
    }
    await produce.save();

    return res.status(StatusCodes.CREATED).json(toOrderDTO(order));
};

// =========================
// PATCH /orders/:id/status
// =========================
const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['confirmed', 'in_transit', 'delivered', 'completed', 'cancelled', 'disputed'];
    if (!status || !validStatuses.includes(status)) {
        throw new BadRequestError(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const order = await Order.findById(id);
    if (!order) {
        throw new NotFoundError(`No order with id: ${id}`);
    }

    const userId = String(req.user.userId);
    if (String(order.buyerId) !== userId && String(order.farmerId) !== userId) {
        throw new UnauthenticatedError('You are not authorized to update this order');
    }

    order.status = status;
    if (notes !== undefined) order.notes = notes;

    if (status === 'completed') {
        order.paymentStatus = 'released';
    } else if (status === 'cancelled') {
        order.paymentStatus = order.depositPaid ? 'refunded' : 'unpaid';
    }

    await order.save();

    return res.status(StatusCodes.OK).json(toOrderDTO(order));
};

module.exports = {
    listOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
};
