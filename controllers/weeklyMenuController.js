const WeeklyMenu = require("../models/WeeklyMenu");
const Meal = require("../models/Meals");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

/**
 * Caterer: Create or Update Weekly Menu
 */
exports.setWeeklyMenu = async (req, res) => {
  const { weekStart, weekEnd, mealsByDay, userId } = req.body;
  if (!weekStart || !weekEnd) throw new BadRequestError("Provide weekStart and weekEnd dates");
  if (!mealsByDay) throw new BadRequestError("Provide mealsByDay object");

  // Validate meals exist
  for (const day of Object.keys(mealsByDay)) {
    for (const mealId of mealsByDay[day]) {
      const meal = await Meal.findById(mealId);
      if (!meal) throw new NotFoundError(`Meal not found: ${mealId}`);
    }
  }

  let menu = await WeeklyMenu.findOne({ weekStart });
  if (menu) {
    menu.mealsByDay = mealsByDay;
    await menu.save();
  } else {
    menu = new WeeklyMenu({ weekStart, weekEnd, mealsByDay, createdBy: userId });
    await menu.save();
  }

  res.status(StatusCodes.OK).json({ message: "Weekly menu set successfully", menu });
};

/**
 * Worker: Get meals for today or full week
 */
exports.getMealsForDayOrWeek = async (req, res) => {
  const { weekStart, day } = req.query;
  let menu = await WeeklyMenu.findOne({ weekStart })
    .populate({
      path: "mealsByDay.monday mealsByDay.tuesday mealsByDay.wednesday mealsByDay.thursday mealsByDay.friday mealsByDay.saturday mealsByDay.sunday",
    });

  if (!menu) throw new NotFoundError("No weekly menu found for that date");

  if (day) {
    const lower = day.toLowerCase();
    return res.status(StatusCodes.OK).json({ meals: menu.mealsByDay[lower] || [] });
  }

  res.status(StatusCodes.OK).json(menu);
};
