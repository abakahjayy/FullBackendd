const express = require('express');
const router = express.Router();

const {
    
    changeDelivery,
    deleteAllCartProducts
} = require('../controllers/cart.js')


router.route('/:id').patch(deleteAllCartProducts)
router.route('/:id/:productId/:option').patch(changeDelivery)



module.exports = router;