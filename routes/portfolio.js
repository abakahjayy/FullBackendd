const express = require('express');
const { submitContact, submitOrder } = require('../controllers/portfolioController.js');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Each submission sends two emails from the owner's Gmail (daily sending limit), so
// cap how often one visitor can submit - stops the forms being used to spam.
// Per visitor: behind Render's proxy req.ip is the proxy, and 'trust proxy' is not
// enabled app-wide (it would change every other app's limiters), so use the address
// Render's proxy appended - the LAST X-Forwarded-For entry (visitors can only fake
// the ones before it).
const visitorIp = (req) => {
    const chain = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    return chain[chain.length - 1] || req.ip;
};
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: visitorIp,
    validate: { xForwardedForHeader: false },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests - please try again in a few minutes.' },
});

// POST /api/contact  - Portfolio "Contact Me" form
router.post('/contact', formLimiter, submitContact);

// POST /api/order    - Portfolio "Order a Website" form
router.post('/order', formLimiter, submitOrder);

module.exports = router;
