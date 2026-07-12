const mongoose = require("mongoose");

const weeklyMenuSchema = new mongoose.Schema(
  {
    weekStart: { type: Date, required: true }, // Monday
    weekEnd: { type: Date, required: true },   // Sunday
    mealsByDay: {
      monday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
      tuesday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
      wednesday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
      thursday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
      friday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
      saturday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
      sunday: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meal" }],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const WeeklyMenu = mongoose.model("WeeklyMenu", weeklyMenuSchema);
module.exports = WeeklyMenu;
