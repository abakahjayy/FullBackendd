const SocialNotification = require('../models/SocialNotification');
const { emitToUserId } = require('./socket');

// profile_picture is the Google photo URL for Google sign-in accounts
const ACTOR_FIELDS = 'username firstName lastName profile_picture_id profile_picture';

// Records a notification and pushes it to the recipient's open tabs over socket.io.
// Never throws: a failed notification must not fail the like/comment/follow itself.
async function notify({ recipient, actor, type, post, text }) {
    try {
        if (!recipient || !actor || String(recipient) === String(actor)) return; // no self-notifications
        // One like/follow notification per actor+target, so like/unlike spam doesn't pile up.
        if (type !== 'comment') {
            await SocialNotification.deleteMany({ recipient, actor, type, ...(post ? { post } : {}) });
        }
        const created = await SocialNotification.create({ recipient, actor, type, post, text: (text || '').slice(0, 140) });
        const full = await SocialNotification.findById(created._id)
            .populate('actor', ACTOR_FIELDS)
            .populate('post', 'postId mediaType');
        emitToUserId(String(recipient), 'notification', full);
    } catch (err) {
        console.warn('notify failed:', err.message);
    }
}

// Undo a like/follow notification when the action is reversed.
async function unnotify({ recipient, actor, type, post }) {
    try {
        await SocialNotification.deleteMany({ recipient, actor, type, ...(post ? { post } : {}) });
    } catch (err) {
        console.warn('unnotify failed:', err.message);
    }
}

module.exports = { notify, unnotify, ACTOR_FIELDS };
