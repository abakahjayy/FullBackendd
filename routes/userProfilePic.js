const express = require('express');
const {upload}= require('../utils/storageMulter.js')
const { editUserProfilePic } = require('../controllers/userController');

const router = express.Router();

router.patch('/:username/editUserProfile', upload().single('profile_pictures'),editUserProfilePic);

module.exports = router;
