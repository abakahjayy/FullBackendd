const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
    name: String,
    description: String,
    cutoff_aggregate: Number,
    university_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'University'
    }
});

const Program = mongoose.model("Program", programSchema);
module.exports = Program;
