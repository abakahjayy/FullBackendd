const express = require('express');
const router = express.Router();

const {
    getDeliveryData,
    getOneDeliveryData
} = require('../controllers/delivery.js')

router.route('/:deliveryOptionId').get(getOneDeliveryData)
router.route('/').get(getDeliveryData)
module.exports = router;