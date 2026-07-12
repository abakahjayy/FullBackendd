const mongoose = require("mongoose");

const userOrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weekStart: { type: Date, required: true },
    ordersByDay: {
        monday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
        tuesday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
        wednesday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
        thursday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
        friday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
        saturday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
        sunday: { meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meals" }, updatedAt: Date },
    }
}, { timestamps: true });

module.exports = mongoose.model("UserOrder", userOrderSchema);
