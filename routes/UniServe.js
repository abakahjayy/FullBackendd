const express= require('express');
const {
    createUniversity,
    getUniversities,
    createProgram,
    getPrograms,
    getRequiredSubjects,
    createStudentInput,
    getRecommendations
} =require('../controllers/UniServe.js');

const router = express.Router();

router.post('/universities', createUniversity);
router.get('/universities', getUniversities);

router.post('/programs', createProgram);
router.get('/programs', getPrograms);

router.get('/required_subjects', getRequiredSubjects);
router.post('/student-inputs', createStudentInput);
router.get('/recommendations', getRecommendations);

module.exports = router;
