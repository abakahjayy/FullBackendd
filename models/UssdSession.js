const mongoose = require('mongoose');

const ussdSessionSchema = new mongoose.Schema({
  sessionId: String,
  userId: String,
  msisdn: String,
  network: String,
  steps: Object,
  userData: String,
  data: String,
  choice: Number,
  current_page: Number,
}, { timestamps: true });

module.exports = mongoose.model('UssdSession', ussdSessionSchema);
