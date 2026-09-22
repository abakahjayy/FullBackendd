const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        description: {
            type: String,
            required: [true, "Please provide a description"],
            trim: true,
            maxlength: 100,
        },
        amount: {
            type: Number,
            required: [true, "Please provide an amount"],
            min: [0.01, "Amount must be greater than 0"],
        },
        type: {
            type: String,
            enum: ["income", "expense"],
            required: [true, "Please provide a type"],
        },
        category: {
            type: String,
            enum: ["food", "housing", "utilities", "transport", "entertainment", "salary", "other"],
            default: "other",
        },
        date: {
            type: Date,
            required: [true, "Please provide a date"],
        },
    },
    { timestamps: true }
);

TransactionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
