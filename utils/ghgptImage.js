// Image generation for GH-GPT ("create an image of ...").
//   - GHGPT_IMAGE_MODEL set (e.g. google/gemini-2.5-flash-image): OpenRouter image
//     model. Paid - needs credits on the OpenRouter account.
//   - otherwise: Pollinations (free, no key). Adds a small watermark.
// Generated images are stored in the GridFS "uploads" bucket and served by
// GET /api/v1/ai/image/:id like user uploads, so they stay in the chat history.
const mongoose = require('mongoose');
const OpenAI = require('openai');
const { Readable } = require('stream');

const TIMEOUT_MS = 90 * 1000;

// "Draw a cat" / "generate an image of ..." / "make me a logo for ..." etc.
const IMAGE_INTENT = /\b(generate|create|draw|make|design|paint|render|sketch|produce|imagine|illustrate|show me)\b[^.?!\n]{0,60}\b(image|picture|pic|photo|drawing|illustration|logo|poster|art(work)?|wallpaper|icon|painting|portrait|sketch|banner|flyer|cartoon|meme|avatar)s?\b/i;
// "Draw a cat", "sketch my house": these verbs mean a picture even without the word image.
const DRAW_VERB = /^\s*(please\s+)?(can you\s+|could you\s+)?(draw|paint|sketch|illustrate)\b/i;
const wantsImage = (prompt) => IMAGE_INTENT.test(String(prompt || '')) || DRAW_VERB.test(String(prompt || ''));

// Keep the description, drop the request wording ("please draw me an image of").
const cleanPrompt = (prompt) =>
    String(prompt || '')
        .replace(/^\s*(please\s+)?(can you\s+|could you\s+)?(generate|create|draw|make|design|paint|render|sketch|produce|imagine|illustrate|show me)\s+(me\s+)?(an?\s+|the\s+)?(image|picture|pic|photo|drawing|illustration|painting)?\s*(of|showing|with|for)?\s*/i, '')
        .trim() || String(prompt || '').trim();

async function saveToGridFS(buffer, contentType, filename) {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    return new Promise((resolve, reject) => {
        const upload = bucket.openUploadStream(filename, { contentType });
        Readable.from(buffer).pipe(upload).on('error', reject).on('finish', () => resolve(upload.id));
    });
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function viaOpenRouter(prompt) {
    const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
    const res = await client.chat.completions.create({
        model: process.env.GHGPT_IMAGE_MODEL,
        messages: [{ role: 'user', content: `Create an image: ${prompt}` }],
        modalities: ['image', 'text'],
    });
    const url = res.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const match = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(url || '');
    if (!match) throw new Error('The image model returned no image');
    return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1], source: process.env.GHGPT_IMAGE_MODEL };
}

// The free service returns an occasional 500/502, so try a few times with a new seed.
const POLLINATIONS_ATTEMPTS = 3;
async function viaPollinations(prompt) {
    let lastError;
    for (let attempt = 1; attempt <= POLLINATIONS_ATTEMPTS; attempt++) {
        try {
            const seed = Math.floor(Math.random() * 1e9);
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=768&height=768&nologo=true&seed=${seed}`;
            const res = await fetchWithTimeout(url);
            const contentType = res.headers.get('content-type') || '';
            if (!res.ok || !contentType.startsWith('image/')) throw new Error(`Image service error (${res.status})`);
            return { buffer: Buffer.from(await res.arrayBuffer()), contentType, source: 'pollinations' };
        } catch (err) {
            lastError = err;
            console.error(`GH-GPT image: attempt ${attempt} failed: ${err.message}`);
            if (attempt < POLLINATIONS_ATTEMPTS) await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
    }
    throw new Error(`The image service is busy right now (${lastError.message}). Please try again.`);
}

/** Generates an image and stores it. Resolves to { fileId, source }. */
async function generateImage(prompt) {
    const description = cleanPrompt(prompt);
    let result;
    if (process.env.GHGPT_IMAGE_MODEL && process.env.OPENROUTER_API_KEY) {
        try {
            result = await viaOpenRouter(description);
        } catch (err) {
            console.error('GH-GPT image: OpenRouter failed, using free generator:', err.status || '', err.message);
        }
    }
    if (!result) result = await viaPollinations(description);
    const ext = (result.contentType.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const fileId = await saveToGridFS(result.buffer, result.contentType, `ghgpt-image-${Date.now()}.${ext}`);
    return { fileId, source: result.source, description };
}

module.exports = { generateImage, wantsImage, cleanPrompt };
