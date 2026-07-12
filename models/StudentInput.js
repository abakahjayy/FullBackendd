const mongoose = require('mongoose');

const studentInputSchema = new mongoose.Schema({
    student_name: String,
    selected_subjects: [String]
});


const StudentInput = mongoose.model("StudentInput", studentInputSchema);
module.exports = StudentInput;
