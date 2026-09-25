const mongoose = require('mongoose');

// A document uploaded to GH-GPT: the original is in the GridFS "uploads" bucket
// (fileId) and its extracted text is kept here so it can be sent to the AI.
const ghgptFileSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
        fileId: { type: mongoose.Types.ObjectId, required: true },
        name: { type: String, required: true },
        mime: String,
        size: Number,
        kind: String, // pdf | docx | xlsx | csv | pptx | text
        pages: Number,
        text: { type: String, required: true },
        truncated: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model('GhgptFile', ghgptFileSchema);
