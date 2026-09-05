// // backend/utils/openaiService.js
// const { OpenAI } = require("openai");

// // ✅ Load from environment variable (RECOMMENDED)
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEYS,
// });

// const askOpenAI = async (prompt, imageBase64 = null) => {
//   try {
//     const messages = [];

//     if (imageBase64) {
//       messages.push({
//         role: "user",
//         content: [
//           {
//             type: "text",
//             text: prompt || "What is in this image?",
//           },
//           {
//             type: "image_url",
//             image_url: {
//               url: `data:image/jpeg;base64,${imageBase64}`,
//             },
//           },
//         ],
//       });
//     } else {
//       messages.push({
//         role: "user",
//         content: prompt,
//       });
//     }

//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o", // ✅ New model with vision + faster + cheaper
//       messages,
//       max_tokens: 1000,
//     });

//     return completion.choices[0].message.content;
//   } catch (error) {
//     console.error("🛑 OpenAI error:", error.response?.data || error.message);
//     throw error;
//   }
// };

// module.exports = askOpenAI;
const OpenAI = require("openai");

// ✅ Use environment variable for safety
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEYS, // e.g., sk-... (from .env)
});

/**
 * Sends a prompt (and optional image) to OpenAI's GPT-4o model.
 *
 * @param {string} prompt - The user's text input.
 * @param {string|null} imageBase64 - Optional base64 image string.
 * @returns {Promise<string>} - The AI's response.
 */
const askOpenAI = async (prompt, imageBase64 = null) => {
  try {
    const messages = [];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: prompt || "What is in this image?",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: prompt,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // GPT-4 Omni (2025), supports vision + text
      messages,
      max_tokens: 1000,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("🛑 OpenAI error:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = askOpenAI;

