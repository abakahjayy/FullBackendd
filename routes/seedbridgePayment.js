const express = require('express');
const router = express.Router();
const seedbridgeAuthMiddleware = require('../middleware/seedbridgeAuth.js');
const {
    initializeCheckout,
    finalizeOrder,
    paystackWebhook,
} = require('../controllers/seedbridgePayment.js');

// Buyer taps "Buy" - starts a hosted Paystack checkout, returns the URL to redirect to.
router.post('/initialize', seedbridgeAuthMiddleware, initializeCheckout);

// Frontend calls this after Paystack redirects back to its own callback URL.
router.get('/finalize/:reference', finalizeOrder);

// Paystack calls this directly - no auth (Paystack can't send your JWT),
// protected instead by signature verification inside the controller. The
// raw-body parsing this needs is wired up in app.js.
router.post('/webhook', paystackWebhook);

module.exports = router;
