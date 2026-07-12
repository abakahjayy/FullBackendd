// models/Meals.js
const mongoose = require('mongoose');

const MealSchema = new mongoose.Schema(
    {
        image: {
            type: String,
            required: [true, 'Please provide an image for the meal'],
        },
        name: {
            type: String,
            required: [true, 'Please enter the meal name'],
        },
        rating: {
            stars: { type: Number, default: 4.0 },
            count: { type: Number, default: 50 },
        },
        priceCents: {
            type: Number,
            required: [true, 'Please enter the meal price in cents'],
        },
        keywords: [String],
        type: {
            type: String, // breakfast, lunch, dinner
        },
        weekSchedule: [
            {
                day: {
                    type: String,
                    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                },
                available: { type: Boolean, default: false },
            },
        ],
        createdBy: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

const Meals = mongoose.model('Meals', MealSchema);
module.exports = Meals;
