// routes/bundleRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/bundleController');

router.get('/', controller.getBundles);        // GET all or filtered by ?network=MTN
router.post('/', controller.createBundle);     // POST a new bundle
router.put('/:id', controller.updateBundle);   // Update bundle
router.delete('/:id', controller.deleteBundle);// Delete bundle

module.exports = router;
