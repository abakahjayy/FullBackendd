const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Post = require('../models/Posts');
const User = require('../models/User');
const Comment = require('../models/Comments');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const posts = require('./postController');
const users = require('./userController');
const comments = require('./commentController');

// Logged-in versions of the Instagram clone's social actions, under /api/v1/instagram.
//
// The original routes (/api/v1/posts, /users/:id/follow, /comments...) trust a userId
// sent by the browser, so anyone can act as anyone. They are still used unchanged by
// other apps on this backend (GHGPT's Chatbot), so they are left exactly as they are.
// These routes take the user from the JWT (authMiddleware -> req.user.userId), check
// ownership where it matters, then reuse the original handlers so behaviour matches.

const me = (req) => req.user.userId;
const validId = (id, what) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestError(`Invalid ${what} id`);
};

// POST /instagram/posts (multipart "file" + caption) - you are the author.
exports.createPost = (req, res) => {
    req.query.userId = me(req);
    return posts.createPost(req, res);
};

// DELETE /instagram/posts/:postId - only the author.
exports.deletePost = async (req, res) => {
    validId(req.params.postId, 'post');
    const post = await Post.findById(req.params.postId, { postId: 1, createdBy: 1 });
    if (!post) throw new NotFoundError('Post not found');
    if (String(post.createdBy) !== me(req)) throw new UnauthenticatedError('You can only delete your own posts');
    req.params.fileId = String(post.postId);
    req.query.userId = me(req);
    return posts.deletePost(req, res);
};

// PATCH /instagram/posts/:postId/like | /unlike - as yourself.
exports.likePost = (req, res) => {
    req.body = { ...req.body, userId: me(req) };
    return posts.likePosts(req, res);
};
exports.unlikePost = (req, res) => {
    req.body = { ...req.body, userId: me(req) };
    return posts.unlikePosts(req, res);
};

// POST /instagram/posts/:postId/comments { text } - as yourself.
exports.addComment = (req, res) => {
    req.body = { text: req.body.text, userId: me(req) };
    return comments.addComment(req, res);
};

// DELETE /instagram/comments/:commentId - the commenter or the post's author.
exports.deleteComment = async (req, res) => {
    validId(req.params.commentId, 'comment');
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) throw new NotFoundError('Comment not found');
    const post = await Post.findById(comment.post, { createdBy: 1 });
    const allowed = String(comment.user) === me(req) || (post && String(post.createdBy) === me(req));
    if (!allowed) throw new UnauthenticatedError('You can only delete your own comments');
    await Comment.deleteOne({ _id: comment._id });
    await Post.updateOne({ _id: comment.post }, { $pull: { comments: comment._id } });
    res.status(StatusCodes.OK).json({ deleted: true, _id: comment._id });
};

// PATCH /instagram/users/:targetId/follow | /unfollow - you follow them.
exports.follow = (req, res) => {
    validId(req.params.targetId, 'user');
    if (req.params.targetId === me(req)) throw new BadRequestError("You can't follow yourself");
    req.body = { userId: req.params.targetId };
    req.params.id = me(req);
    return users.followUser(req, res);
};
exports.unfollow = (req, res) => {
    validId(req.params.targetId, 'user');
    req.body = { userId: req.params.targetId };
    req.params.id = me(req);
    return users.unfollowUser(req, res);
};

// PATCH /instagram/me { firstName, lastName, username, bio } - your own profile only.
const PUBLIC_FIELDS = '-password -tokens -resetPasswordToken -resetPasswordExpires';
exports.updateMe = async (req, res) => {
    const update = {};
    for (const key of ['firstName', 'lastName', 'username', 'bio']) {
        if (typeof req.body[key] === 'string' && req.body[key].trim()) update[key] = req.body[key].trim();
    }
    if (update.username && !/^[a-zA-Z0-9._]{3,30}$/.test(update.username)) {
        throw new BadRequestError('Usernames can use letters, numbers, . and _ (3-30 characters)');
    }
    const user = await User.findByIdAndUpdate(me(req), update, { new: true, runValidators: true }).select(PUBLIC_FIELDS);
    res.status(StatusCodes.OK).json({ user });
};

// PATCH /instagram/me/photo (multipart "photo") - your own profile picture.
exports.updateMyPhoto = async (req, res) => {
    if (!req.file) throw new BadRequestError('Please choose a photo');
    const user = await User.findById(me(req));
    const old = user.profile_picture_id;
    user.profile_picture_id = req.file.id;
    await user.save();
    if (old) {
        await new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' }).delete(old).catch(() => {});
    }
    const fresh = await User.findById(me(req)).select(PUBLIC_FIELDS);
    res.status(StatusCodes.OK).json({ user: fresh });
};
