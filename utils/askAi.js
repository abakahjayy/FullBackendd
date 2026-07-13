// backend/utils/askAi.js
const OpenAI = require('openai');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer':  process.env.CLIENT_URL_AI || 'http://localhost:7009', // Change to your site URL (required for ranking)
        'X-Title': 'GH-GPT App', // Optional: Name of your app
    },
});

// Free-tier models as of July 2026. OpenRouter's free lineup rotates
// periodically — if either of these starts 404ing like llama-3-8b-instruct
// did, check https://openrouter.ai/models?fmt=cards&order=top-weekly&max_price=0
// for current replacements, or just switch to 'openrouter/free' below, which
// auto-selects a working free model for you (including vision-capable ones).
const TEXT_MODEL = 'openai/gpt-5.6-luna-pro';
const VISION_MODEL = 'openai/gpt-5.6-luna-pro';

const askAI = async (prompt, imageBase64 = null) => {
    try {
        const messages = [];

        if (imageBase64) {
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
            messages.push({
                role: 'user',
                content: prompt,
            });
        }

        const response = await openai.chat.completions.create({
            model: imageBase64 ? VISION_MODEL : TEXT_MODEL,
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
// // backend/utils/askAi.js
// const OpenAI = require('openai');

// const openai = new OpenAI({
//     baseURL: 'https://openrouter.ai/api/v1',
//     apiKey: process.env.OPENROUTER_API_KEY,
//     defaultHeaders: {
//         'HTTP-Referer':  process.env.CLIENT_URL || 'http://localhost:7005', // Change to your site URL (required for ranking)
//         'X-Title': 'GH-GPT App', // Optional: Name of your app
//     },
// });

// const askAI = async (prompt, imageBase64 = null) => {
//     try {
//         const messages = [];

//         if (imageBase64) {
//             // GPT-4o supports image + text
//             messages.push({
//                 role: 'user',
//                 content: [
//                     {
//                         type: 'text',
//                         text: prompt || 'What is this image?',
//                     },
//                     {
//                         type: 'image_url',
//                         image_url: {
//                             url: `data:image/jpeg;base64,${imageBase64}`,
//                         },
//                     },
//                 ],
//             });
//         } else {
//             // Text-only
//             messages.push({
//                 role: 'user',
//                 content: prompt,
//             });
//         }

//         const response = await openai.chat.completions.create({
//             model: imageBase64 ? 'openai/gpt-4o' : 'meta-llama/llama-3.1-8b-instruct', // ✅ Adjust as per your OpenRouter access
//             messages,
//             max_tokens: 1000,
//         });

//         return response.choices[0].message.content;
//     } catch (error) {
//         console.error('🔴 OpenRouter error:', error.response?.data || error.message);
//         throw error;
//     }
// };

// module.exports = askAI;
