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
            },
        ],
    },
    { timestamps: true }
);

// export default mongoose.models.Chat || mongoose.model("Chat", chatSchema);
const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
