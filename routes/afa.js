const express = require('express');
const router = express.Router();
const {
  registerAFA,
  getAllAFA,
  deleteAFA,
  updateAFA,
} = require('../controllers/afacontroller');

// POST - Create new registration
router.post('/register', registerAFA);

// GET - Get all registrations
router.get('/registrations', getAllAFA);

// PUT - Update a registration by ID
router.put('/registrations/:id', updateAFA);

// DELETE - Delete a registration by ID
router.delete('/registrations/:id', deleteAFA);

module.exports = router;
