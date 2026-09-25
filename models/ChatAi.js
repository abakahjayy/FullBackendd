const mongoose = require("mongoose");
const chatSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: [true, 'Please Provide the User Id']
        },
        history: [
            {
                role: {
                    type: String,
                    enum: ["user", "model"],
                    required: true,
                },
                parts: [
                    {
                        text: {
                            type: String,
                            required: false,
                        },
                    },
                ],
                img: {
                    type: mongoose.Types.ObjectId,
                    ref: 'uploads',
                    required: false,
                },
                // GH-GPT: documents attached to this message and their extracted text
                // (kept so follow-up questions can use them). See controllers/ghgpt.js.
                attachments: [
                    {
                        fileId: { type: mongoose.Types.ObjectId },
                        name: String,
                        mime: String,
                        size: Number,
                        kind: String,
                    },
                ],
                docText: { type: String, required: false },
            },
        ],
    },
    { timestamps: true }
);

// export default mongoose.models.Chat || mongoose.model("Chat", chatSchema);
const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
