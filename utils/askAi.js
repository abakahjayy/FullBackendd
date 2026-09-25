// backend/utils/askAi.js
// Single-question helper used by POST /api/v1/ai/ask. It goes through the same
// provider fallback as GH-GPT (utils/ghgptAi.js): OpenRouter -> OpenAI -> free,
// so a revoked OpenRouter key no longer breaks every answer.
const { completeChat, buildMessages } = require('./ghgptAi');

const askAI = async (prompt, imageBase64 = null) => {
    try {
        return await completeChat({ messages: buildMessages({ prompt, imageBase64 }) });
    } catch (error) {
        console.error('🔴 AI error:', error.message);
        throw error;
    }
};

module.exports = askAI;
