const mongoose = require('mongoose');

const afaRegistrationSchema = new mongoose.Schema({
  fullname: String,
  idnumber: String,
  dob: String,
  phone: String,
  location: String,
  region: String,
  occupation: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AFARegistration', afaRegistrationSchema);
