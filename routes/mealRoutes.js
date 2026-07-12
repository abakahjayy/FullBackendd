const express = require("express");
const mongoose = require("mongoose");
const Meals = require("../models/Meals");
const WeeklyMenu = require("../models/WeeklyMenu");
const { ObjectId } = require("mongodb");
const { UnauthenticatedError, BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");

const router = express.Router();

/**
 * Caterer/Admin: Create a new meal
 */
router.post("/", async (req, res) => {
  const { image, name, priceCents, type, createdBy } = req.body;
  if (!image || !name || !priceCents || !createdBy)
    throw new BadRequestError("Missing required fields");

  const user = await User.findById(createdBy);
  if (!user) throw new NotFoundError(`No User found with id:${createdBy}`);

  const meal = await Meals.create({ image, name, priceCents, type, createdBy });

  console.log(
    "\x1b[34m%s\x1b[0m",
    `Meal created: ${meal.name} (₵${meal.priceCents / 100})`
  );
  res.status(StatusCodes.CREATED).json({ message: "Meal created successfully", meal });
});

/**
 * Public: Get all meals
 */
router.get("/", async (req, res) => {
  const meals = await Meals.find().populate("createdBy", "name email");
  res.status(StatusCodes.OK).json({ nbHits: meals.length, meals });
});

/**
 * Get meal by ID
 */
router.get("/:mealId", async (req, res) => {
  const { mealId } = req.params;
  const meal = await Meals.findById(mealId).populate("createdBy", "name email");
  if (!meal) throw new NotFoundError(`No meal found with id:${mealId}`);
  res.status(StatusCodes.OK).json({ meal });
});

/**
 * Update meal
 */
router.patch("/:mealId", async (req, res) => {
  const { mealId } = req.params;
  const meal = await Meals.findByIdAndUpdate(mealId, req.body, { new: true, runValidators: true });
  if (!meal) throw new NotFoundError(`No meal found with id:${mealId}`);
  res.status(StatusCodes.OK).json({ message: "Meal updated successfully", meal });
});

/**
 * Delete meal
 */
router.delete("/:mealId", async (req, res) => {
  const { mealId } = req.params;
  const meal = await Meals.findByIdAndDelete(mealId);
  if (!meal) throw new NotFoundError(`No meal found with id:${mealId}`);
  res.status(StatusCodes.OK).json({ message: "Meal deleted successfully", meal });
});

/**
 * Caterer: Set weekly meal plan (each day ≥ 3 meals)
 */
router.post("/weekly-menu", async (req, res) => {
  const { createdBy, mealsByDay } = req.body;
  // mealsByDay = { monday:[mealIds], tuesday:[...], ... }

  if (!createdBy) throw new BadRequestError("createdBy required");
  const user = await User.findById(createdBy);
  if (!user || user.role !== "caterer") throw new UnauthenticatedError("Only caterer can set weekly menu");

  const validDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  for (const day of validDays) {
    if (!mealsByDay[day] || mealsByDay[day].length < 3)
      throw new BadRequestError(`Each day must have at least 3 meals. Missing: ${day}`);
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday

  const existing = await WeeklyMenu.findOne({ weekStart, createdBy });
  if (existing) await WeeklyMenu.findByIdAndDelete(existing._id);

  const menu = await WeeklyMenu.create({ weekStart, weekEnd, mealsByDay, createdBy });
  res.status(StatusCodes.CREATED).json({ message: "Weekly menu created", menu });
});

/**
 * Caterer: Update daily meals
 */
router.patch("/daily-menu/:day", async (req, res) => {
  const { day } = req.params;
  const { createdBy, meals } = req.body; // meals = [mealIds]
  const validDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

  if (!validDays.includes(day)) throw new BadRequestError("Invalid day");
  if (!createdBy || !Array.isArray(meals) || meals.length < 3)
    throw new BadRequestError("Each day must have at least 3 meals");

  const weekMenu = await WeeklyMenu.findOne({ createdBy }).sort({ createdAt: -1 });
  if (!weekMenu) throw new NotFoundError("Weekly menu not found");

  weekMenu.mealsByDay[day] = meals;
  await weekMenu.save();

  res.status(StatusCodes.OK).json({ message: `${day} menu updated`, weekMenu });
});

/**
 * Public: Get meals available today (or given day)
 */
router.get("/available/:day?", async (req, res) => {
  const validDays = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  let { day } = req.params;
  if (!day) {
    const now = new Date();
    day = validDays[now.getDay() - 1] || "monday";
  }

  if (!validDays.includes(day)) throw new BadRequestError("Invalid day");

  const weekMenu = await WeeklyMenu.findOne().sort({ createdAt: -1 }).populate({
    path: `mealsByDay.${day}`,
    populate: { path: "createdBy", select: "name email" },
  });

  const meals = weekMenu?.mealsByDay?.[day] || [];
  res.status(StatusCodes.OK).json({ day, meals });
});

module.exports = router;
