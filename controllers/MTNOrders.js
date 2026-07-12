const Orders = require('../models/MTNOrders');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

// ✅ GET all orders
const getAllOrders = async (req, res) => {
  const orders = await Orders.find({}).sort('-createdAt');
  res.status(StatusCodes.OK).json(orders);
};

// ✅ GET a single order
const getOrder = async (req, res) => {
  const { id } = req.params;
  const order = await Orders.findById(id);
  if (!order) throw new NotFoundError(`No order with ID: ${id}`);
  res.status(StatusCodes.OK).json(order);
};

// ✅ CREATE a new order
const createOrder = async (req, res) => {
  const { recipient, quantity, network, price, payment, status, updated } = req.body;

  if (!recipient || !quantity || !network || !price) {
    throw new BadRequestError("All fields except 'updated' are required.");
  }

  const order = await Orders.create({ recipient, quantity, network, price, payment, status, updated });
  res.status(StatusCodes.CREATED).json(order);
};

// ✅ UPDATE an order
const updateOrder = async (req, res) => {
  const { id } = req.params;
  const update = req.body;

  const order = await Orders.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });

  if (!order) throw new NotFoundError(`No order with ID: ${id}`);
  res.status(StatusCodes.OK).json(order);
};

// ✅ DELETE an order
const deleteOrder = async (req, res) => {
  const { id } = req.params;
  const order = await Orders.findByIdAndDelete(id);

  if (!order) throw new NotFoundError(`No order with ID: ${id}`);
  res.status(StatusCodes.OK).json({ msg: 'Order deleted' });
};

// ✅ UPDATE only the status of an order
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new BadRequestError("Status is required");
  }

  const order = await Orders.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!order) throw new NotFoundError(`No order with ID: ${id}`);
  res.status(StatusCodes.OK).json({ msg: "Status updated", updatedOrder: order });
};


// ✅ GET orders by email
const getOrdersByEmail = async (req, res) => {
  const { email } = req.params;

  if (!email) {
    throw new BadRequestError("Email parameter is required");
  }

  const orders = await Orders.find({ email }).sort('-createdAt');

  if (!orders || orders.length === 0) {
    throw new NotFoundError(`No orders found for email: ${email}`);
  }

  res.status(StatusCodes.OK).json(orders);
};



module.exports = {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  getOrdersByEmail
};
