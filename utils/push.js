// Web Push ("notifications on the device itself") for every app on this backend.
//
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from the environment if set;
// otherwise a key pair is generated once and stored in MongoDB (collection
// "appsettings", _id "vapid"), so local and Render share the same keys without
// any manual setup. Never change the keys casually: every existing
// subscription is tied to the public key and would stop working.
//
// pushToUser / pushToAdmins never throw; expired subscriptions (404/410) are deleted.
const mongoose = require('mongoose');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

let vapidPromise = null;

async function loadVapid() {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
        const col = mongoose.connection.db.collection('appsettings');
        let doc = await col.findOne({ _id: 'vapid' });
        if (!doc) {
            const keys = webpush.generateVAPIDKeys();
            doc = { _id: 'vapid', publicKey: keys.publicKey, privateKey: keys.privateKey, createdAt: new Date() };
            try {
                await col.insertOne(doc);
            } catch (err) {
                // Another instance created them first: use those.
                if (err.code !== 11000) throw err;
                doc = await col.findOne({ _id: 'vapid' });
            }
        }
        publicKey = doc.publicKey;
        privateKey = doc.privateKey;
    }
    const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.EMAIL_USER || 'admin@example.com'}`;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey };
}

const getVapid = () => {
    if (!vapidPromise) {
        vapidPromise = loadVapid().catch((err) => {
            vapidPromise = null; // retry next time (e.g. DB not connected yet)
            throw err;
        });
    }
    return vapidPromise;
};

const getPublicKey = async () => (await getVapid()).publicKey;

/**
 * payload: { title, body, url?, tag?, icon?, badge? }. `url` is where a tap opens.
 * Returns the number of devices reached.
 */
async function sendToSubscriptions(subs, payload) {
    if (!subs.length) return 0;
    await getVapid();
    const data = JSON.stringify({
        title: String(payload.title || 'Notification').slice(0, 120),
        body: String(payload.body || '').slice(0, 300),
        url: payload.url || '/',
        tag: payload.tag,
        icon: payload.icon,
        badge: payload.badge,
        app: payload.app,
    });
    let delivered = 0;
    await Promise.all(subs.map(async (sub) => {
        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, data, { TTL: 24 * 3600, urgency: payload.urgency || 'normal' });
            delivered++;
            PushSubscription.updateOne({ _id: sub._id }, { lastSuccessAt: new Date() }).catch(() => {});
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
            } else {
                console.error(`Push to ${sub.app} device failed:`, err.statusCode || '', err.body || err.message);
            }
        }
    }));
    return delivered;
}

/** Notify one user's devices for one app (or all their apps if app is omitted). */
async function pushToUser(userId, payload, { app, realm = 'user' } = {}) {
    try {
        if (!userId) return 0;
        const query = { userId, realm, ...(app && { app }) };
        const subs = await PushSubscription.find(query).lean();
        return await sendToSubscriptions(subs, { ...payload, app: payload.app || app });
    } catch (err) {
        console.error('pushToUser failed:', err.message);
        return 0;
    }
}

// Who counts as "the owner" for alerts such as portfolio messages: admin accounts,
// the account using the owner email (EMAIL_USER), and OWNER_ALERT_USERNAMES
// (comma-separated; defaults to the owner's everyday account).
const ownerUsernames = () => (process.env.OWNER_ALERT_USERNAMES || 'jayy').split(',').map((u) => u.trim()).filter(Boolean);

/** Notify the owner/admin accounts on all of their devices, e.g. portfolio messages. */
async function pushToAdmins(payload) {
    try {
        const ownerEmail = String(process.env.EMAIL_USER || '').toLowerCase();
        const admins = await User.find({
            $or: [
                { role: 'admin' },
                { username: { $in: ownerUsernames() } },
                ...(ownerEmail ? [{ email: ownerEmail }] : []),
            ],
        }, '_id').lean();
        if (!admins.length) return 0;
        const subs = await PushSubscription.find({ realm: 'user', userId: { $in: admins.map((a) => a._id) } }).lean();
        return await sendToSubscriptions(subs, payload);
    } catch (err) {
        console.error('pushToAdmins failed:', err.message);
        return 0;
    }
}

async function saveSubscription({ userId, realm = 'user', app, subscription, userAgent }) {
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys || {};
    if (!endpoint || !/^https:\/\//.test(endpoint) || !keys.p256dh || !keys.auth) {
        const err = new Error('Invalid push subscription');
        err.statusCode = 400;
        throw err;
    }
    // One row per device endpoint; re-subscribing moves it to the current user/app.
    return PushSubscription.findOneAndUpdate(
        { endpoint },
        { userId, realm, app, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent: String(userAgent || '').slice(0, 300) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

const removeSubscription = (endpoint, userId) => PushSubscription.deleteOne({ endpoint, ...(userId && { userId }) });

module.exports = { getPublicKey, pushToUser, pushToAdmins, saveSubscription, removeSubscription };
