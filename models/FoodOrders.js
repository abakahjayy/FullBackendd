const mongoose = require("mongoose");

const foodordersSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        mealName: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        pricePerMeal: {
            type: Number,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "preparing", "completed"],
            default: "pending",
        },
        orderedByRole: {
            type: String,
            enum: ["worker", "caterer", "admin"],
            required: true,
        },
        date: {
            type: Date,
            default: () => new Date(), // Automatically set today's date
        },
        dayOfWeek: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
},
    },
    { timestamps: true }
);


const FoodOrders = mongoose.model('FoodOrders', foodordersSchema);
module.exports = FoodOrders;
