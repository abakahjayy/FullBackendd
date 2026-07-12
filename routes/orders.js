const express = require('express');
const router = express.Router();

const { getAllOrders,
        createOrder,
        deleteOrder,
        updateOrder,
        getOrder
    } = require('../controllers/orders.js')


router.route('/').post(createOrder).get(getAllOrders)

router.route('/:id').get(getOrder).delete(deleteOrder).patch(updateOrder)



module.exports = router;