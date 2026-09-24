const express = require('express');
const {upload}= require('../utils/storageMulter.js')
const { followUser, unfollowUser, getUser,getUserByName,editUser,getAllUsers,deleteUser,searchUsers } = require('../controllers/userController');
const authenticationMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
// authenticationMiddleware, adminOnly, 
const router = express.Router();

router.delete('/:id',authenticationMiddleware, adminOnly,  deleteUser);

router.patch('/:id/follow', followUser);
router.patch('/:id/unfollow', unfollowUser);
router.get('/search', searchUsers); // must stay above '/:id'
router.get('/:id', getUser);
router.get('/',getAllUsers);
router.patch('/:username', getUserByName);
router.patch('/:username/editUser',editUser);

module.exports = router;
