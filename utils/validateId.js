const mongoose = require('mongoose');

// Check if an ObjectId is valid
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

module.exports = { isValidObjectId };
