const express = require('express');
const router = express.Router();
const seedbridgeAuthMiddleware = require('../middleware/seedbridgeAuth.js');
const {
    listProduce,
    listFreshRescue,
    listPreHarvest,
    getProduce,
    createProduce,
    updateProduce,
    deleteProduce,
} = require('../controllers/seedbridgeProduce.js');

// Public browsing.
router.get('/', listProduce);
router.get('/fresh-rescue', listFreshRescue);
router.get('/pre-harvest', listPreHarvest);
router.get('/:id', getProduce);

// Mutating routes require an authenticated farmer.
router.post('/', seedbridgeAuthMiddleware, createProduce);
router.patch('/:id', seedbridgeAuthMiddleware, updateProduce);
router.delete('/:id', seedbridgeAuthMiddleware, deleteProduce);

module.exports = router;
