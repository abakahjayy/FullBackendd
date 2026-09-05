const University =require('../models/University.js');
const Program = require('../models/Program.js');
const RequiredSubject= require('../models/RequiredSubject.js');
const StudentInput = require('../models/StudentInput.js');

exports.createUniversity = async (req, res) => {
    const university = new University(req.body);
    await university.save();
    res.json(university);
};

exports.getUniversities = async (req, res) => {
    const universities = await University.find();
    res.json(universities);
};

exports.createProgram = async (req, res) => {
    const { required_subjects, ...programData } = req.body;
    const program = new Program(programData);
    await program.save();

    const subjects = await RequiredSubject.insertMany(
        required_subjects.map(subject => ({
            ...subject,
            program_id: program._id
        }))
    );

    res.json(program);
};

exports.getPrograms = async (req, res) => {
    const programs = await Program.find();
    res.json(programs);
};

exports.getRequiredSubjects = async (req, res) => {
    const subjects = await RequiredSubject.find();
    res.json(subjects);
};

exports.createStudentInput = async (req, res) => {
    const input = new StudentInput(req.body);
    await input.save();
    res.json(input);
};

exports.getRecommendations = async (req, res) => {
    const inputSubjects = req.query.subjects?.split(',').map(s => s.trim().toLowerCase()) || [];
    const matchingPrograms = [];

    const programs = await Program.find();
    for (const program of programs) {
        const requiredSubjects = await RequiredSubject.find({ program_id: program._id });

        if (
            requiredSubjects.length > 0 &&
            requiredSubjects.every(sub =>
                inputSubjects.includes(sub.subject_name.toLowerCase())
            )
        ) {
            matchingPrograms.push(program);
        }
    }

    res.json(matchingPrograms);
};
