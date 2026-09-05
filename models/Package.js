const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  bundle: String,
  price: Number,
  network: String,
  status: Number,
  available: Number,
});

module.exports = mongoose.model('Package', packageSchema);
