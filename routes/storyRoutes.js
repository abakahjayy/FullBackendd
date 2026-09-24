const express = require('express');
const authMiddleware = require('../middleware/auth');
const { postUpload } = require('../utils/storageMulter');
const { createStory, getStoryFeed, markViewed, getViewers, deleteStory } = require('../controllers/storyController');

const router = express.Router();
router.use(authMiddleware);

router.post('/', postUpload('file'), createStory);
router.get('/feed', getStoryFeed);
router.post('/:id/view', markViewed);
router.get('/:id/viewers', getViewers);
router.delete('/:id', deleteStory);

module.exports = router;
