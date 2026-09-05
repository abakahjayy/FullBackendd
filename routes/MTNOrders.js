const express = require('express');
const router = express.Router();
const {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  getOrdersByEmail,
} = require('../controllers/MTNOrders');

router.route('/').get(getAllOrders).post(createOrder);
router.route('/:email').get(getOrdersByEmail);
router.route('/:id').get(getOrder).patch(updateOrder).delete(deleteOrder);
router.patch('/:id/status', updateOrderStatus); // ✅ New route just for status


module.exports = router;
