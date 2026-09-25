// GH-GPT AI calls with automatic provider fallback.
//
// Providers are tried in order until one answers:
//   1. OpenRouter  (OPENROUTER_API_KEY, model OPENROUTER_MODEL)
//   2. OpenAI      (OPENAI_API_KEYS, model OPENAI_MODEL)
//   3. Pollinations - free, keyless, text-only (disable with GHGPT_FREE_FALLBACK=false)
// A provider is skipped once it has failed with an auth error (bad/revoked key)
// until the server restarts, so a dead key doesn't slow every request down.
// If a provider fails before sending any text we move on to the next one; once
// text has been streamed to the user we can't switch, so the error is thrown.
const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are GH-GPT, a friendly and knowledgeable AI assistant built in Ghana.
Give accurate, well-structured answers. Use Markdown: headings for long answers, bullet lists, tables when useful, and fenced code blocks with a language tag for code.
Be concise for simple questions and thorough for complex ones. If you are not sure about something, say so.`;

const MAX_HISTORY_MESSAGES = 20; // recent turns sent as context
const MAX_TOKENS = 2000;

const deadProviders = new Set();

function providers({ needsVision }) {
    const list = [];
    if (process.env.OPENROUTER_API_KEY) {
        list.push({
            name: 'openrouter',
            vision: true,
            model: process.env.OPENROUTER_MODEL || 'openai/gpt-5.6-luna-pro',
            client: new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: process.env.OPENROUTER_API_KEY,
                defaultHeaders: {
                    'HTTP-Referer': process.env.CLIENT_URL_AI || 'https://gh-gpt.onrender.com',
                    'X-Title': 'GH-GPT App',
                },
            }),
        });
    }
    if (process.env.OPENAI_API_KEYS) {
        list.push({
            name: 'openai',
            vision: true,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            client: new OpenAI({ apiKey: process.env.OPENAI_API_KEYS }),
        });
    }
    if (process.env.GHGPT_FREE_FALLBACK !== 'false') {
        list.push({
            name: 'free',
            vision: false,
            model: process.env.GHGPT_FREE_MODEL || 'openai-fast',
            client: new OpenAI({ baseURL: 'https://text.pollinations.ai/openai', apiKey: 'free' }),
        });
    }
    return list.filter((p) => !deadProviders.has(p.name) && (!needsVision || p.vision));
}

const isAuthError = (err) => [401, 403].includes(err?.status);

// Turns stored chat history + the new question into OpenAI-style messages.
// `history` items are { role: 'user'|'model', parts: [{ text }], img? }.
function buildMessages({ history = [], prompt, imageBase64, imageMime = 'image/jpeg', customInstructions }) {
    let system = SYSTEM_PROMPT;
    if (customInstructions && String(customInstructions).trim()) {
        system += `\n\nThe user has given these custom instructions. Follow them unless they are unsafe:\n${String(customInstructions).trim().slice(0, 1500)}`;
    }
    const messages = [{ role: 'system', content: system }];

    history
        .filter((m) => m?.parts?.[0]?.text && m.parts[0].text !== '.')
        .slice(-MAX_HISTORY_MESSAGES)
        .forEach((m) => {
            const text = m.img ? `[The user shared an image] ${m.parts[0].text}` : m.parts[0].text;
            messages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: text });
        });

    if (imageBase64) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: prompt || 'What is in this image?' },
                { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
            ],
        });
    } else {
        messages.push({ role: 'user', content: prompt });
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
            if (isAuthError(err)) deadProviders.add(p.name);
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
            maxTokens: 20,
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
