const express = require('express');
const router = express.Router();
const { handleUssd } = require('../controllers/seedbridgeUssd.js');

// Africa's Talking POSTs application/x-www-form-urlencoded data here.
// No auth - the gateway itself is the only thing that calls this URL
// (configured in your Africa's Talking dashboard), and the USSD menu
// authenticates the end user by their phone number against SeedBridgeUser.
router.post('/', handleUssd);

module.exports = router;
