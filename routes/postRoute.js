const express = require('express');
const { createPost, getPosts, getImage, getMedia ,deletePost,getUserPosts,likePosts,unlikePosts} = require('../controllers/postController');
const {postUpload} = require('../utils/storageMulter');

const router = express.Router();

router.route('/').post( postUpload('file'), createPost);
router.get('/', getPosts);
router.get('/user/:id', getUserPosts);
router.get('/image/:id', getImage);
// Streams images and videos inline with HTTP Range support, so <video> can seek.
router.get('/media/:id', getMedia);
router.delete('/image/:fileId', deletePost);
router.patch('/:postId/like', likePosts);
router.patch('/:postId/unlike', unlikePosts);

module.exports = router;
