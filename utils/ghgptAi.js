// GH-GPT AI calls with automatic provider fallback.
//
// Providers are tried in order until one answers:
//   1. OpenRouter OPENROUTER_MODEL, if set (e.g. a paid model once the account has credits)
//   2. Google Gemini (GEMINI_API_KEY, free tier from aistudio.google.com; reads images)
//   3. OpenRouter free models (GHGPT_OPENROUTER_FREE_MODELS; vision-capable ones for images)
//   4. OpenAI (OPENAI_API_KEYS, model OPENAI_MODEL)
//   5. Pollinations - free, keyless, text-only (disable with GHGPT_FREE_FALLBACK=false)
// OpenRouter's free models are shared and rate limited (429s are common), which is
// why several are tried. A provider that fails with an auth error (bad/revoked key)
// is skipped until the server restarts. If a provider fails before sending any
// text we move on; once text has been streamed we can't switch, so it throws.
const OpenAI = require('openai');

const FENCE = '```';
const SYSTEM_PROMPT = `You are GH-GPT, a friendly and knowledgeable AI assistant built in Ghana.
Give accurate, well-structured answers. Use Markdown: headings for long answers, bullet lists, tables when useful, and fenced code blocks with a language tag for code.
Be concise for simple questions and thorough for complex ones. If you are not sure about something, say so.

Charts: when the user asks for a graph, chart or plot (or data is clearer as one), include a fenced code block with the language "chart" containing only JSON in this shape:
${FENCE}chart
{"type":"bar","title":"Sales by month","xKey":"month","series":["sales"],"data":[{"month":"Jan","sales":120},{"month":"Feb","sales":150}]}
${FENCE}
"type" is one of "bar", "line", "area" or "pie" (for pie, use one series). Use real numbers, not strings. You may add a short explanation outside the block.
The app renders these charts for the user. You cannot create or draw images yourself; image requests are handled by the app's image generator.
When the user attaches documents, their text is included in the message. Answer using that content, and quote or cite the relevant parts.`;

const MAX_HISTORY_MESSAGES = 20; // recent turns sent as context
const MAX_TOKENS = 3000;
const OLD_DOC_CHARS = 6000; // document text kept for earlier messages in the context

// Free OpenRouter models, most capable first. All of these can also read images.
const DEFAULT_FREE_MODELS = [
    { id: 'openrouter/free', vision: true },
    { id: 'google/gemma-4-31b-it:free', vision: true },
    { id: 'qwen/qwen3.8-27b:free', vision: true },
    { id: 'google/gemma-4-26b-a4b-it:free', vision: true },
    { id: 'nex-agi/nex-n2.5-mini:free', vision: true },
];

const deadProviders = new Set();

const openRouterClient = () => new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': process.env.CLIENT_URL_AI || 'https://gh-gpt.onrender.com',
        'X-Title': 'GH-GPT App',
    },
});

function freeOpenRouterModels() {
    if (!process.env.GHGPT_OPENROUTER_FREE_MODELS) return DEFAULT_FREE_MODELS;
    return process.env.GHGPT_OPENROUTER_FREE_MODELS.split(',').map((id) => id.trim()).filter(Boolean).map((id) => ({ id, vision: true }));
}

function providers({ needsVision }) {
    const list = [];
    const openRouter = process.env.OPENROUTER_API_KEY ? openRouterClient() : null;
    if (openRouter && process.env.OPENROUTER_MODEL) {
        list.push({ name: `openrouter:${process.env.OPENROUTER_MODEL}`, key: 'openrouter', vision: true, model: process.env.OPENROUTER_MODEL, client: openRouter });
    }
    if (process.env.GEMINI_API_KEY) {
        list.push({
            name: 'gemini',
            key: 'gemini',
            vision: true,
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            client: new OpenAI({ baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: process.env.GEMINI_API_KEY }),
        });
    }
    if (openRouter) {
        freeOpenRouterModels().forEach((m) => list.push({ name: `openrouter:${m.id}`, key: 'openrouter', vision: m.vision, model: m.id, client: openRouter }));
    }
    if (process.env.OPENAI_API_KEYS) {
        list.push({
            name: 'openai',
            key: 'openai',
            vision: true,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            client: new OpenAI({ apiKey: process.env.OPENAI_API_KEYS }),
        });
    }
    if (process.env.GHGPT_FREE_FALLBACK !== 'false') {
        list.push({
            name: 'free',
            key: 'free',
            vision: false,
            model: process.env.GHGPT_FREE_MODEL || 'openai-fast',
            client: new OpenAI({ baseURL: 'https://text.pollinations.ai/openai', apiKey: 'free' }),
        });
    }
    return list.filter((p) => !deadProviders.has(p.key) && (!needsVision || p.vision));
}

const isAuthError = (err) => [401, 403].includes(err?.status);

const documentBlock = (docs, limit) =>
    (docs || [])
        .map((d) => {
            const text = limit && d.text.length > limit ? `${d.text.slice(0, limit)}\n… (shortened)` : d.text;
            return `--- Attached document: ${d.name} ---\n${text}\n--- End of ${d.name} ---`;
        })
        .join('\n\n');

// Turns stored chat history + the new question into OpenAI-style messages.
// `history` items are { role: 'user'|'model', parts: [{ text }], img?, attachments?, docText? }.
// `documents` are the new message's attachments: [{ name, text }].
function buildMessages({ history = [], prompt, imageBase64, imageMime = 'image/jpeg', customInstructions, documents }) {
    let system = SYSTEM_PROMPT;
    if (customInstructions && String(customInstructions).trim()) {
        system += `\n\nThe user has given these custom instructions. Follow them unless they are unsafe:\n${String(customInstructions).trim().slice(0, 1500)}`;
    }
    const messages = [{ role: 'system', content: system }];

    history
        .filter((m) => (m?.parts?.[0]?.text || m?.docText) && m.parts?.[0]?.text !== '.')
        .slice(-MAX_HISTORY_MESSAGES)
        .forEach((m) => {
            let text = m.parts?.[0]?.text || '';
            if (m.role === 'model' && m.img) text = `[GH-GPT generated an image] ${text}`;
            else if (m.img) text = `[The user shared an image] ${text}`;
            if (m.docText) {
                const names = (m.attachments || []).map((a) => a.name).join(', ') || 'document';
                text = `${documentBlock([{ name: names, text: m.docText }], OLD_DOC_CHARS)}\n\n${text}`;
            }
            messages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: text });
        });

    const question = documents?.length ? `${documentBlock(documents)}\n\n${prompt || 'Please summarise the attached document(s).'}` : prompt;
    if (imageBase64) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: question || 'What is in this image?' },
                { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
            ],
        });
    } else {
        messages.push({ role: 'user', content: question });
    }
    return messages;
}

/**
 * Streams a chat completion. Calls onToken(text) for each chunk and resolves to
 * { text, provider }. Pass an AbortSignal to stop early (resolves with the text so far).
 */
async function streamChat({ messages, onToken = () => {}, signal, maxTokens = MAX_TOKENS }) {
    const needsVision = messages.some((m) => Array.isArray(m.content));
    const candidates = providers({ needsVision });
    if (candidates.length === 0) {
        const err = new Error(needsVision
            ? 'Image questions need a working OpenRouter or OpenAI API key on the server.'
            : 'No AI provider is configured on the server.');
        err.status = 503;
        err.statusCode = 503;
        throw err;
    }

    let lastError;
    for (const p of candidates) {
        let text = '';
        try {
            const stream = await p.client.chat.completions.create(
                { model: p.model, messages, max_tokens: maxTokens, stream: true },
                { signal }
            );
            for await (const chunk of stream) {
                const piece = chunk.choices?.[0]?.delta?.content;
                if (piece) {
                    text += piece;
                    onToken(piece);
                }
            }
            if (!text && !signal?.aborted) throw new Error('The AI returned an empty answer');
            return { text, provider: p.name };
        } catch (err) {
            if (signal?.aborted) return { text, provider: p.name, aborted: true };
            if (text) throw err; // already streaming this provider's answer
            if (isAuthError(err)) deadProviders.add(p.key);
            console.error(`GH-GPT AI: ${p.name} failed (${err.status || ''} ${err.message}); trying next provider`);
            lastError = err;
        }
    }
    const err = new Error(`The AI service is unavailable right now (${lastError?.message || 'unknown error'}). Please try again.`);
    err.status = 502;
    err.statusCode = 502;
    throw err;
}

// Non-streaming convenience wrapper.
async function completeChat(options) {
    const { text } = await streamChat(options);
    return text;
}

// A short title for a new conversation, e.g. "Capital of Ghana".
async function generateTitle(question, answer) {
    const fallback = heuristicTitle(question);
    try {
        const text = await completeChat({
            maxTokens: 400, // reasoning models think before answering
            messages: [
                { role: 'system', content: 'You write very short titles for chat conversations. Reply with the title only: 2 to 6 words, no quotes, no trailing punctuation.' },
                { role: 'user', content: `Question: ${String(question).slice(0, 500)}\n\nAnswer: ${String(answer).slice(0, 500)}` },
            ],
        });
        const title = text.replace(/^["'\s#*]+|["'\s.*]+$/g, '').split('\n')[0].trim();
        return title && title.length <= 60 ? title : fallback;
    } catch {
        return fallback;
    }
}

function heuristicTitle(question) {
    const words = String(question || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
    const clean = words.replace(/[?.!,;:]+$/, '');
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'New chat';
}

module.exports = { streamChat, completeChat, buildMessages, generateTitle, heuristicTitle };
