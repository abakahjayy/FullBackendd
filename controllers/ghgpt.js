const crypto = require('crypto');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const Chat = require('../models/ChatAi');
const UserChats = require('../models/UserChatAi');
const { BadRequestError, NotFoundError } = require('../errors');
const { streamChat, buildMessages, generateTitle, heuristicTitle } = require('../utils/ghgptAi');
const { sendGhgptEmail, verifyUnsubscribeToken, siteUrl, emailEnabled } = require('../utils/ghgptMail');

// GH-GPT (GHGPT-main/Chatbot) logged-in API, mounted at /api/v1/ghgpt.
// Every route takes the user from the JWT (req.user.userId) and only touches
// that user's chats. The older /api/v1/ai/* routes (userId in the URL) are
// left as they were for existing clients.

const MAX_PROMPT_CHARS = 20000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PLACEHOLDER = '.'; // text of the first message of an empty "New Chat"

const isPlaceholder = (m) => m && m.role === 'user' && !m.img && m.parts?.[0]?.text === PLACEHOLDER;

async function findOwnChat(userId, chatId) {
    if (!mongoose.Types.ObjectId.isValid(chatId)) throw new NotFoundError('Chat not found');
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new NotFoundError('Chat not found');
    return chat;
}

async function readImage(fileId) {
    if (!mongoose.Types.ObjectId.isValid(String(fileId))) throw new BadRequestError('Invalid image id');
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    const [file] = await bucket.find({ _id: new ObjectId(String(fileId)) }).toArray();
    if (!file) throw new NotFoundError('Image not found');
    if (!/^image\//.test(file.contentType || '')) throw new BadRequestError('That file is not an image');
    if (file.length > MAX_IMAGE_BYTES) throw new BadRequestError('Image is too large (max 10 MB)');
    const chunks = [];
    await new Promise((resolve, reject) => {
        bucket.openDownloadStream(file._id)
            .on('data', (c) => chunks.push(c))
            .on('end', resolve)
            .on('error', reject);
    });
    return { base64: Buffer.concat(chunks).toString('base64'), mime: file.contentType };
}

// ---- Streaming answers --------------------------------------------------------
// POST /chats/:chatId/stream  (Server-Sent Events)
// body: { prompt?, imageId?, customInstructions?, mode?: 'send'|'regenerate'|'edit', editIndex? }
//   send       - add a new question (text and/or an image uploaded via POST /uploads)
//   regenerate - replace the last answer with a new one
//   edit       - replace the user message at editIndex (and everything after it)
// Events: {type:'token',text} ... {type:'done',history} then maybe {type:'title',title};
// {type:'error',message} if the AI fails after the stream started.
// If the client disconnects (Stop button) the partial answer is saved.
exports.streamMessage = async (req, res) => {
    const userId = req.user.userId;
    const { chatId } = req.params;
    const mode = req.body.mode || 'send';
    const customInstructions = req.body.customInstructions;
    if (!['send', 'regenerate', 'edit'].includes(mode)) throw new BadRequestError('mode must be send, regenerate or edit');

    const chat = await findOwnChat(userId, chatId);
    // Indexes from the client count the hidden placeholder, so remember whether we removed it.
    const hadPlaceholder = chat.history.length > 0 && isPlaceholder(chat.history[0]);
    if (hadPlaceholder) chat.history.splice(0, 1);

    let prompt = String(req.body.prompt || '').trim();
    let imageId = req.body.imageId || null;
    if (prompt.length > MAX_PROMPT_CHARS) throw new BadRequestError('Message is too long');

    let context; // history sent to the AI before the question
    if (mode === 'regenerate') {
        const last = chat.history[chat.history.length - 1];
        if (!last || last.role !== 'model') throw new BadRequestError('There is no answer to regenerate');
        chat.history.pop();
        const question = chat.history[chat.history.length - 1];
        if (!question || question.role !== 'user') throw new BadRequestError('There is no question to answer');
        prompt = question.parts?.[0]?.text || '';
        imageId = question.img || null;
        context = chat.history.slice(0, -1);
    } else {
        if (mode === 'edit') {
            const index = Number(req.body.editIndex) - (hadPlaceholder ? 1 : 0);
            if (!Number.isInteger(index) || index < 0 || index >= chat.history.length || chat.history[index].role !== 'user') {
                throw new BadRequestError('Invalid message to edit');
            }
            imageId = imageId || chat.history[index].img || null;
            chat.history.splice(index); // drop the old question and everything after it
        }
        if (!prompt && !imageId) throw new BadRequestError('Please type a message or attach an image');
        context = chat.history.slice();
    }

    const image = imageId ? await readImage(imageId) : null;
    const messages = buildMessages({
        history: context,
        prompt: prompt || 'What is in this image?',
        imageBase64: image?.base64,
        imageMime: image?.mime,
        customInstructions,
    });

    // Start the event stream.
    res.status(StatusCodes.OK);
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const send = (event) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    send({ type: 'start' });

    const controller = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded) controller.abort();
    });

    let result;
    try {
        result = await streamChat({ messages, signal: controller.signal, onToken: (text) => send({ type: 'token', text }) });
    } catch (err) {
        send({ type: 'error', message: err.message || 'The AI could not answer. Please try again.' });
        return res.end();
    }

    const answer = result.text || (result.aborted ? '_Response stopped._' : '');
    if (mode !== 'regenerate') {
        chat.history.push({ role: 'user', parts: [{ text: prompt }], ...(imageId && { img: imageId }) });
    }
    chat.history.push({ role: 'model', parts: [{ text: answer }] });
    await chat.save();

    send({ type: 'done', history: chat.history, provider: result.provider, stopped: Boolean(result.aborted) });

    // Name new chats after their first exchange.
    const userChats = await UserChats.findOne({ userId });
    const entry = userChats?.chats.find((c) => String(c.chatId) === String(chatId));
    if (entry && (!entry.title || entry.title === PLACEHOLDER || entry.title === 'New Chat')) {
        entry.title = result.aborted ? heuristicTitle(prompt || 'Image chat') : await generateTitle(prompt || 'An image', answer);
        await userChats.save();
        send({ type: 'title', title: entry.title });
    }
    res.end();
};

// ---- Images -------------------------------------------------------------------
// POST /uploads (multipart field "file") -> { fileId }. The route file runs the
// GridFS upload (routes/ghgptUploadRoutes.js); this just reports the id.
exports.uploadImage = async (req, res) => {
    if (!req.file) throw new BadRequestError('Please attach an image');
    res.status(StatusCodes.CREATED).json({ fileId: req.file.id, url: `/api/v1/ai/image/${req.file.id}` });
};

// ---- Chat list management -------------------------------------------------------
async function updateOwnChatEntry(userId, chatId, update) {
    if (!mongoose.Types.ObjectId.isValid(chatId)) throw new NotFoundError('Chat not found');
    const set = Object.fromEntries(Object.entries(update).map(([k, v]) => [`chats.$.${k}`, v]));
    const result = await UserChats.findOneAndUpdate(
        { userId, 'chats.chatId': chatId },
        { $set: set },
        { new: true }
    );
    if (!result) throw new NotFoundError('Chat not found');
    return result.chats.find((c) => String(c.chatId) === String(chatId));
}

// PATCH /chats/:chatId/title { title }
exports.renameChat = async (req, res) => {
    const title = String(req.body.title || '').replace(/\s+/g, ' ').trim();
    if (!title) throw new BadRequestError('Title cannot be empty');
    if (title.length > 80) throw new BadRequestError('Title is too long (max 80 characters)');
    const chat = await updateOwnChatEntry(req.user.userId, req.params.chatId, { title });
    res.status(StatusCodes.OK).json({ chat });
};

// PATCH /chats/:chatId/pin { pinned }
exports.pinChat = async (req, res) => {
    if (typeof req.body.pinned !== 'boolean') throw new BadRequestError('pinned must be true or false');
    const chat = await updateOwnChatEntry(req.user.userId, req.params.chatId, { pinned: req.body.pinned });
    res.status(StatusCodes.OK).json({ chat });
};

// ---- Email --------------------------------------------------------------------
// POST /chats/:chatId/email - sends the conversation to the signed-in user's own address.
const MAX_EMAIL_MESSAGES = 40;
exports.emailChat = async (req, res) => {
    if (!emailEnabled) throw new BadRequestError('Email is not configured on this server');
    const [chat, user, list] = await Promise.all([
        findOwnChat(req.user.userId, req.params.chatId),
        User.findById(req.user.userId, 'email username firstName ghgptEmailNotifications'),
        UserChats.findOne({ userId: req.user.userId }),
    ]);
    if (!user?.email) throw new BadRequestError('Your account has no email address');

    const title = list?.chats.find((c) => String(c.chatId) === String(chat._id))?.title;
    const blocks = chat.history
        .filter((m) => !isPlaceholder(m))
        .slice(-MAX_EMAIL_MESSAGES)
        .map((m) => ({
            who: m.role === 'user' ? 'You' : 'GH-GPT',
            text: `${m.img ? '[Image] ' : ''}${String(m.parts?.[0]?.text || '').slice(0, 6000)}`,
        }));
    if (!blocks.length) throw new BadRequestError('This chat is empty');

    const sent = await sendGhgptEmail(user, {
        title: `Your GH-GPT chat: ${title && title !== PLACEHOLDER ? title : 'Conversation'}`,
        message: 'Here is a copy of your conversation, as you asked.',
        blocks,
        cta: { label: 'Continue this chat', url: siteUrl(`/chat/${chat._id}`) },
        force: true, // the user asked for this email
    });
    if (!sent) throw new BadRequestError('The email could not be sent. Please try again later.');
    res.status(StatusCodes.OK).json({ sent: true, to: user.email });
};

// POST /events { type: 'signup'|'login', deviceId } - welcome / new sign-in emails,
// sent by the GH-GPT app after it signs someone in (the shared /auth routes stay untouched).
const MAX_DEVICES = 10;
const deviceKey = (id) => crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 32);
const describeDevice = (ua = '') => {
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'a device';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    return `${browser} on ${os}`;
};

exports.authEvent = async (req, res) => {
    const { type, deviceId } = req.body;
    if (!['signup', 'login'].includes(type)) throw new BadRequestError('type must be signup or login');
    if (!deviceId || String(deviceId).length > 100) throw new BadRequestError('deviceId is required');

    const user = await User.findById(req.user.userId, 'email username firstName ghgptEmailNotifications ghgptWelcomedAt ghgptDevices');
    if (!user) throw new NotFoundError('User not found');
    const key = deviceKey(deviceId);
    const knownDevice = user.ghgptDevices.includes(key);
    let sent = null;

    if (!user.ghgptWelcomedAt) {
        // First time this account uses GH-GPT (new signup, or an existing account from another app).
        user.ghgptWelcomedAt = new Date();
        sent = 'welcome';
        sendGhgptEmail(user, {
            title: `Welcome to GH-GPT, ${user.firstName || user.username}!`,
            message: `Your GH-GPT account is ready.

Ask questions, get help writing and coding, summarise long text, or attach an image and ask about it. GH-GPT remembers the conversation, so you can ask follow-up questions, and every chat is saved in your history.

Tip: set custom instructions in Settings to tell GH-GPT how you'd like it to answer.`,
            cta: { label: 'Start chatting', url: siteUrl('/dashboard') },
        });
    } else if (type === 'login' && !knownDevice && user.ghgptDevices.length > 0) {
        sent = 'new-sign-in';
        sendGhgptEmail(user, {
            title: 'New sign-in to your GH-GPT account',
            message: `Your account @${user.username} was just signed in to from ${describeDevice(req.headers['user-agent'])} (${new Date().toUTCString()}).

If this was you, there's nothing to do. If it wasn't, reset your password right away.`,
            cta: { label: 'Review your account', url: siteUrl(`/${user.username}`) },
            force: true, // security email
        });
    }

    if (!knownDevice) user.ghgptDevices = [key, ...user.ghgptDevices].slice(0, MAX_DEVICES);
    await user.save();
    res.status(StatusCodes.OK).json({ ok: true, sent });
};

// GET /settings, PATCH /settings/email { emailNotifications }
exports.getSettings = async (req, res) => {
    const user = await User.findById(req.user.userId, 'email ghgptEmailNotifications');
    res.status(StatusCodes.OK).json({
        email: user?.email || null,
        emailNotifications: user?.ghgptEmailNotifications !== false,
        emailEnabled,
    });
};

exports.setEmailPreference = async (req, res) => {
    const { emailNotifications } = req.body;
    if (typeof emailNotifications !== 'boolean') throw new BadRequestError('emailNotifications must be true or false');
    await User.updateOne({ _id: req.user.userId }, { ghgptEmailNotifications: emailNotifications });
    res.status(StatusCodes.OK).json({ emailNotifications });
};

// ---- Unsubscribe (no login: the link carries a signed token) --------------------
// GET shows a confirmation page (link scanners open GET links, so GET changes
// nothing); POST unsubscribes and is also Gmail's RFC 8058 one-click target.
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a202c}
.card{max-width:420px;margin:16px;padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;text-align:center}
h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;color:#4a5568}button,a.btn{display:inline-block;margin-top:12px;padding:10px 18px;border:0;border-radius:8px;background:#3182ce;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;cursor:pointer}</style>
</head><body><div class="card">${body}</div></body></html>`;

exports.unsubscribePage = async (req, res) => {
    try {
        verifyUnsubscribeToken(String(req.query.token || ''));
    } catch {
        return res.status(400).send(page('Link not valid', "<h1>This link isn't valid</h1><p>You can turn emails off in GH-GPT: Settings → Email.</p>"));
    }
    const safeToken = String(req.query.token).replace(/[^\w.-]/g, '');
    res.send(page('Stop emails', `<h1>Stop GH-GPT emails?</h1>
<p>You'll stop getting GH-GPT emails such as welcome messages and product updates. Security alerts and chats you email to yourself still arrive.</p>
<form method="post" action="?token=${safeToken}"><button type="submit">Unsubscribe</button></form>`));
};

exports.unsubscribe = async (req, res) => {
    let userId;
    try {
        userId = verifyUnsubscribeToken(String(req.query.token || ''));
    } catch {
        return res.status(400).send(page('Link not valid', "<h1>This link isn't valid</h1>"));
    }
    await User.updateOne({ _id: userId }, { ghgptEmailNotifications: false });
    res.send(page('Unsubscribed', `<h1>You're unsubscribed</h1>
<p>We won't send you GH-GPT emails any more. You can turn them back on in Settings.</p>
<a class="btn" href="${siteUrl('/')}">Open GH-GPT</a>`));
};
