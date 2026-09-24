const express = require('express');
const { createPost, getPosts, getImage, getMedia ,deletePost,getUserPosts,likePosts,unlikePosts,getLikedPosts,getSavedPosts,toggleSavePost} = require('../controllers/postController');
const {postUpload} = require('../utils/storageMulter');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.route('/').post( postUpload('file'), createPost);
router.get('/', getPosts);
router.get('/saved', authMiddleware, getSavedPosts);
router.get('/user/:id', getUserPosts);
router.get('/liked/:id', getLikedPosts);
router.get('/image/:id', getImage);
// Streams images and videos inline with HTTP Range support, so <video> can seek.
router.get('/media/:id', getMedia);
router.delete('/image/:fileId', deletePost);
router.patch('/:postId/like', likePosts);
router.patch('/:postId/unlike', unlikePosts);
router.patch('/:postId/save', authMiddleware, toggleSavePost);

module.exports = router;
