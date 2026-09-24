const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const { BadRequestError } = require('../errors');
const { sendInstagramEmail, verifyUnsubscribeToken, siteUrl, emailEnabled } = require('../utils/instagramMail');

// ---- Unsubscribe (same pattern as controllers/cleanbridgeEmail.js) ----------
// GET shows a confirmation page (link scanners open GET links, so GET changes
// nothing); POST unsubscribes and is also Gmail's RFC 8058 one-click target.
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#262626}
.card{max-width:420px;margin:16px;padding:28px;background:#fff;border:1px solid #dbdbdb;border-radius:12px;text-align:center}
h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;color:#737373}button,a.btn{display:inline-block;margin-top:12px;padding:10px 18px;border:0;border-radius:8px;background:#0095f6;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;cursor:pointer}</style>
</head><body><div class="card">${body}</div></body></html>`;

exports.unsubscribePage = async (req, res) => {
    try {
        verifyUnsubscribeToken(String(req.query.token || ''));
    } catch {
        return res.status(400).send(page('Link not valid', "<h1>This link isn't valid</h1><p>You can turn emails off in the app: Edit profile → Email notifications.</p>"));
    }
    const safeToken = String(req.query.token).replace(/[^\w.-]/g, '');
    res.send(page('Stop emails', `<h1>Stop Instagram Clone emails?</h1>
<p>You'll stop getting emails about new followers, comments, messages and app updates. You'll still see everything in the app.</p>
<form method="post" action="?token=${safeToken}"><button type="submit">Unsubscribe</button></form>`));
};

exports.unsubscribe = async (req, res) => {
    let userId;
    try {
        userId = verifyUnsubscribeToken(String(req.query.token || ''));
    } catch {
        return res.status(400).send(page('Link not valid', "<h1>This link isn't valid</h1>"));
    }
    await User.updateOne({ _id: userId }, { emailNotifications: false });
    res.send(page('Unsubscribed', `<h1>You're unsubscribed</h1>
<p>We won't email you any more. Turn emails back on any time from Edit profile.</p>
<a class="btn" href="${siteUrl('/')}">Open Instagram Clone</a>`));
};

// ---- Settings ---------------------------------------------------------------
// PATCH /api/v1/instagram/settings/email { emailNotifications: boolean }
exports.setEmailPreference = async (req, res) => {
    const { emailNotifications } = req.body;
    if (typeof emailNotifications !== 'boolean') throw new BadRequestError('emailNotifications must be true or false');
    await User.updateOne({ _id: req.user.userId }, { emailNotifications });
    res.status(StatusCodes.OK).json({ emailNotifications });
};

// ---- App updates (admin) ----------------------------------------------------
// POST /api/v1/instagram/updates { subject, message, ctaLabel?, ctaPath?, test? }
// Emails everyone who hasn't opted out. `test: true` sends only to the admin.
// Capped per call because the Gmail relay allows ~100 emails/day.
const MAX_PER_CALL = 90;

exports.sendUpdate = async (req, res) => {
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    if (!subject || !message) throw new BadRequestError('Subject and message are required');
    if (subject.length > 120 || message.length > 5000) throw new BadRequestError('Subject or message is too long');
    if (!emailEnabled) throw new BadRequestError('Email is not configured on this server');
    const cta = req.body.ctaLabel ? { label: String(req.body.ctaLabel).slice(0, 40), url: siteUrl(String(req.body.ctaPath || '/')) } : undefined;

    const query = req.body.test
        ? { _id: req.user.userId }
        : { email: { $exists: true, $ne: '' }, emailNotifications: { $ne: false } };
    const recipients = await User.find(query, 'email emailNotifications username firstName').limit(MAX_PER_CALL + 1);

    let sent = 0;
    for (const user of recipients.slice(0, MAX_PER_CALL)) {
        // force only for the admin's own test copy
        if (await sendInstagramEmail(user, { title: subject, message, cta, force: !!req.body.test })) sent++;
    }
    res.status(StatusCodes.OK).json({
        sent,
        attempted: Math.min(recipients.length, MAX_PER_CALL),
        truncated: recipients.length > MAX_PER_CALL,
    });
};
