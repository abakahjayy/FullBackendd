const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Story = require('../models/Story');
const User = require('../models/User');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const USER_FIELDS = 'username firstName lastName profile_picture_id profile_picture';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

// Delete expired stories and their files. Runs opportunistically on reads, so there
// is no cron job to keep alive on Render's free tier.
async function purgeExpired() {
    const expired = await Story.find({ expiresAt: { $lte: new Date() } }, { fileId: 1 }).limit(100);
    if (!expired.length) return;
    await Promise.all(expired.map((s) => bucket().delete(s.fileId).catch(() => {})));
    await Story.deleteMany({ _id: { $in: expired.map((s) => s._id) } });
}

// POST /api/v1/stories (multipart field "file", image or video)
exports.createStory = async (req, res) => {
    if (!req.file) {
        throw new BadRequestError('Please add a photo or video');
    }
    const story = await Story.create({
        user: req.user.userId,
        fileId: req.file.id,
        mediaType: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
    });
    res.status(StatusCodes.CREATED).json({ story });
};

// GET /api/v1/stories/feed - live stories from you and the people you follow,
// grouped per user: yours first, then unseen, then most recent.
exports.getStoryFeed = async (req, res) => {
    await purgeExpired();
    const me = req.user.userId;
    const viewer = await User.findById(me, { following: 1 });
    const authors = [me, ...(viewer?.following || [])];

    const stories = await Story.find({ user: { $in: authors }, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: 1 })
        .populate('user', USER_FIELDS);

    const byUser = new Map();
    for (const s of stories) {
        if (!s.user) continue;
        const key = String(s.user._id);
        if (!byUser.has(key)) byUser.set(key, { user: s.user, stories: [] });
        byUser.get(key).stories.push({
            _id: s._id,
            fileId: s.fileId,
            mediaType: s.mediaType,
            createdAt: s.createdAt,
            seen: s.viewers.some((v) => String(v) === me),
            ...(key === me ? { viewCount: s.viewers.length } : {}),
        });
    }

    const groups = [...byUser.values()].map((g) => ({
        ...g,
        isMine: String(g.user._id) === me,
        allSeen: g.stories.every((s) => s.seen),
        latest: g.stories[g.stories.length - 1].createdAt,
    }));
    groups.sort((a, b) => (b.isMine - a.isMine) || (a.allSeen - b.allSeen) || (b.latest - a.latest));
    res.status(StatusCodes.OK).json({ groups });
};

// POST /api/v1/stories/:id/view
exports.markViewed = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestError('Invalid story id');
    await Story.updateOne({ _id: id, user: { $ne: req.user.userId } }, { $addToSet: { viewers: req.user.userId } });
    res.status(StatusCodes.OK).json({ ok: true });
};

// GET /api/v1/stories/:id/viewers - owner only
exports.getViewers = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestError('Invalid story id');
    const story = await Story.findById(id).populate('viewers', USER_FIELDS);
    if (!story) throw new NotFoundError('Story not found');
    if (String(story.user) !== req.user.userId) throw new UnauthenticatedError('Only the owner can see viewers');
    res.status(StatusCodes.OK).json({ viewers: story.viewers });
};

// DELETE /api/v1/stories/:id - owner only
exports.deleteStory = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestError('Invalid story id');
    const story = await Story.findById(id);
    if (!story) throw new NotFoundError('Story not found');
    if (String(story.user) !== req.user.userId) throw new UnauthenticatedError('You can only delete your own story');
    await bucket().delete(story.fileId).catch(() => {});
    await story.deleteOne();
    res.status(StatusCodes.OK).json({ deleted: true });
};
