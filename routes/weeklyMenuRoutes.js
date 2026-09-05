const express = require("express");
const router = express.Router();
const { setWeeklyMenu, getMealsForDayOrWeek } = require("../controllers/weeklyMenuController");

router.post("/", setWeeklyMenu);
router.get("/", getMealsForDayOrWeek);

module.exports = router;
