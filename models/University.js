const mongoose = require('mongoose');

const universitySchema = new mongoose.Schema({
    name: String,
    location: String
});

const University = mongoose.model("University", universitySchema);
module.exports = University;
