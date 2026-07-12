const mongoose = require("mongoose");

const gpioActivitySchema = new mongoose.Schema(
    {
        pin: {
            type: String,
            required: true,
            enum: ["led", "fan", "motor"], // optional: restrict to known pins
        },
        state: {
            type: Boolean,
            required: true, // true = ON, false = OFF
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // optional: link to the user who triggered it
            default: null,
        },
        source: {
            type: String,
            enum: ["voice", "dashboard", "ai"],
            default: "dashboard", // helps track how it was triggered
        },
    },
    { timestamps: true } // automatically adds createdAt & updatedAt
);

const GpioActivity = mongoose.model("GpioActivity", gpioActivitySchema);
module.exports = GpioActivity
