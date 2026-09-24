const mongoose = require('mongoose');

// Instagram-style story: a photo/video (GridFS `uploads` bucket, served by
// GET /api/v1/posts/media/:fileId) that disappears 24h after posting.
// Expired stories are deleted - file included - by controllers/storyController.js
// (not a TTL index, which would leave the GridFS file behind).
const StorySchema = new mongoose.Schema({
    user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
    fileId: { type: mongoose.Types.ObjectId, required: true },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    viewers: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Story', StorySchema);
