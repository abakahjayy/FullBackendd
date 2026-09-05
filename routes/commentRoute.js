const express = require('express');
const { addComment,deleteComment,getPostComments } = require('../controllers/commentController');

const router = express.Router();

router.post('/:postId', addComment);
router.delete('/:postId', deleteComment);
router.get('/:postId', getPostComments);

module.exports = router;
