const express = require('express');
const { createPost, getPosts, getImage ,deletePost,getUserPosts,likePosts,unlikePosts} = require('../controllers/postController');
const {upload} = require('../utils/storageMulter');

const router = express.Router();

router.route('/').post( upload().single('file'), createPost);
router.get('/', getPosts);
router.get('/user/:id', getUserPosts);
router.get('/image/:id', getImage);
router.delete('/image/:fileId', deletePost);
router.patch('/:postId/like', likePosts);
router.patch('/:postId/unlike', unlikePosts);

module.exports = router;
