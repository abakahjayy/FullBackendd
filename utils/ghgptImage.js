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

// "Draw a cat" / "generate an image of ..." / "send me a picture of jollof" / "make me a logo" etc.
const IMAGE_INTENT = /\b(generate|create|draw|make|design|paint|render|sketch|produce|imagine|illustrate|show|send|give|get|find|share|want|need)\b[^.?!\n]{0,60}\b(image|picture|pic|photo|photograph|drawing|illustration|logo|poster|art(work)?|wallpaper|icon|painting|portrait|sketch|banner|flyer|cartoon|meme|avatar)s?\b/i;
// "Draw a cat", "sketch my house": these verbs mean a picture even without the word image.
const DRAW_VERB = /^\s*(please\s+)?(can you\s+|could you\s+)?(draw|paint|sketch|illustrate)\b/i;
// A request that is just "picture of X" / "an image of X".
const BARE_REQUEST = /^\s*(please\s+)?(an?\s+)?(image|picture|pic|photo|drawing|illustration)s?\s+of\b/i;
// Questions ("How do I share a photo?") are about pictures, not requests for one,
// unless they ask to be shown/sent one ("can you show me a picture of...").
const QUESTION = /^\s*(how|what|why|where|when|who|which|whose|is|are|was|were|does|do|did|should|would|can i|could i|will)\b/i;
const ASKS_FOR_ONE = /\b(show|send|give|draw|generate|create|make)\s+(me|us)\b/i;
const wantsImage = (prompt) => {
    const p = String(prompt || '');
    if (QUESTION.test(p) && !ASKS_FOR_ONE.test(p)) return false;
    return IMAGE_INTENT.test(p) || DRAW_VERB.test(p) || BARE_REQUEST.test(p);
};

// Keep the description, drop the request wording ("please send me a picture of").
// Only request wording is removed; a plain description ("A steaming plate of ...")
// is left exactly as written.
const REQUEST_PHRASE = /^\s*(please\s+)?(can you\s+|could you\s+|i want\s+|i need\s+|i'd like\s+)?((generate|create|draw|make|design|paint|render|sketch|produce|imagine|illustrate|show|send|give|get|find|share)\s+(me\s+|us\s+)?)?((an?|the|some)\s+)?(image|picture|pic|photo|photograph|drawing|illustration|painting)s?\s+(of|showing)\s+/i;
const REQUEST_VERB = /^\s*(please\s+)?(can you\s+|could you\s+)?(draw|paint|sketch|illustrate|generate|create|make|design|render|produce|imagine)\s+(me\s+|us\s+)?/i;
const cleanPrompt = (prompt) => {
    const original = String(prompt || '').trim();
    const stripped = REQUEST_PHRASE.test(original) ? original.replace(REQUEST_PHRASE, '') : original.replace(REQUEST_VERB, '');
    return stripped.trim() || original;
};

// The AI is told to answer picture requests with a single "[[IMAGE: description]]"
// line; some models instead invent a tool call such as
//   { "action": "dalle.text2im", "action_input": "{ "prompt": "..." }" }.
// Returns the picture description from either form, or null.
function imageRequestFromAnswer(text) {
    const t = String(text || '');
    const tag = /\[\[\s*IMAGE\s*:\s*([\s\S]+?)\]\]/i.exec(t);
    if (tag) return tag[1].trim();
    if (/dall-?e|text2im|image_gen|generate_image|create_image|image_generation/i.test(t)) {
        const m = /\\?"prompt\\?"\s*:\s*\\?"([^"\\]{3,})/.exec(t);
        if (m) return m[1].trim();
    }
    return null;
}

// While streaming: does the answer so far look like it's becoming one of those?
// (Used to hide raw tool-call text from the user.)
const looksLikeImageRequest = (partial) => {
    const t = String(partial || '').trimStart();
    return /^\[\[/.test(t) || /^(```(json)?\s*)?\{\s*"?(action|tool|name|prompt)"?\s*:/i.test(t) || /dall-?e|text2im/i.test(t.slice(0, 200));
};

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

module.exports = { generateImage, wantsImage, cleanPrompt, imageRequestFromAnswer, looksLikeImageRequest };
