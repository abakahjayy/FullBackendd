const express = require('express');
const router = express.Router();


const {
    getAllProducts,
    getAllProductsStatic,
    getProduct,
} = require('../controllers/products')
const {login} = require('../controllers/auth.js')



router.route('/static').get(getAllProductsStatic)
router.route('/').get(getAllProducts).post(login, getAllProducts)
router.route('/:id').get(getProduct)

module.exports = router;
