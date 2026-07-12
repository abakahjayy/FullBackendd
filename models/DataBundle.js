// models/DataBundle.js
const mongoose = require('mongoose');

const DataBundleSchema = new mongoose.Schema({
    network: {
      type: String,
      enum: ['mtn', 'tigo', 'telecel'],
      required: true
    },
    size: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    }
});

module.exports = mongoose.model('DataBundle', DataBundleSchema);
