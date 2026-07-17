const express = require('express');
const { submitContact, submitOrder } = require('../controllers/portfolioController.js');
const router = express.Router();

// POST /api/contact  - Portfolio "Contact Me" form
router.post('/contact', submitContact);

// POST /api/order    - Portfolio "Order a Website" form
router.post('/order', submitOrder);

module.exports = router;
