const mongoose = require('mongoose');

const requiredSubjectSchema = new mongoose.Schema({
    subject_name: String,
    min_grade: String,
    program_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program'
    }
});


const RequiredSubject = mongoose.model("RequiredSubject", requiredSubjectSchema);
module.exports = RequiredSubject;

