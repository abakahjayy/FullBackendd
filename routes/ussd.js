const express = require('express');
const router = express.Router();
const UssdSession = require('../models/UssdSession'); // Make sure this model exists and is connected to MongoDB

// Get all USSD sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await UssdSession.find();
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get USSD sessions by userID
router.get('/sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await UssdSession.find({ userId });
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
});

module.exports = router;