// backend/utils/askAi.js
const OpenAI = require('openai');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:7005', // Change to your site URL (required for ranking)
        'X-Title': 'GH-GPT App', // Optional: Name of your app
    },
});

const askAI = async (prompt, imageBase64 = null) => {
    try {
        const messages = [];

        if (imageBase64) {
            // GPT-4o supports image + text
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt || 'What is this image?',
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`,
                        },
                    },
                ],
            });
        } else {
            // Text-only
            messages.push({
                role: 'user',
                content: prompt,
            });
        }

        const response = await openai.chat.completions.create({
            model: imageBase64 ? 'openai/gpt-4o' : 'meta-llama/llama-3-8b-instruct', // ✅ Adjust as per your OpenRouter access
            messages,
            max_tokens: 1000,
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('🔴 OpenRouter error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = askAI;
