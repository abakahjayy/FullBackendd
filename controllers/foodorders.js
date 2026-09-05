const mongoose = require("mongoose");
const FoodOrders = require("../models/FoodOrders");
const { ObjectId } = require("mongodb");
const { UnauthenticatedError, BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const Meal = require("../models/Meals");
const WeeklyMenu = require("../models/WeeklyMenu"); // ✅ add at top after other imports

/**
 * Worker/Admin: Place a new order
 */

// const cutoffHour = 11; // 11 AM local

// function isBefore11AM() {
//   const now = new Date();
//   return now.getHours() < cutoffHour;
// }
exports.createOrder = async (req, res) => {
    const { userId, mealId, quantity } = req.body;

    if (!userId) throw new BadRequestError("Please provide userId");
    if (!mealId) throw new BadRequestError("Please provide mealId");

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError(`No User found with id:${userId}`);

    const meal = await Meal.findById(mealId);
    if (!meal) throw new NotFoundError(`No Meal found with id:${mealId}`);

    // ✅ Enforce max 2 meals per user per day
    const today = new Date();
    today.setHours(0, 0, 0, 0); // midnight today
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const ordersToday = await FoodOrders.countDocuments({
        userId,
        createdAt: { $gte: today, $lt: tomorrow },
    });
    // console.log(user.role)

    if (ordersToday >= 1 &&user.role !== "admin") {
        return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "You can only order a maximum of 1 meal per day." });
    }

    const qty = quantity || 1;

    // ✅ Convert priceCents to cedis
    const pricePerMeal = meal.priceCents / 100;
    const totalPrice = pricePerMeal * qty;

    // ✅ Determine role automatically from user
    const orderedByRole = user.role || "worker";

    const order = new FoodOrders({
        userId,
        mealId,
        mealName: meal.name, // ✅ REQUIRED
        quantity: qty,
        pricePerMeal,        // ✅ REQUIRED
        totalPrice,          // ✅ REQUIRED
        orderedByRole,       // ✅ REQUIRED
        date: new Date(),    // auto-set
    });

    await order.save();

    console.log(
        "\x1b[34m%s\x1b[0m",
        `User: ${user.name} (${orderedByRole}) ordered ${qty} x ${meal.name} (₵${totalPrice.toFixed(2)})`
    );

    res.status(StatusCodes.CREATED).json({ order, user });
};


/**
 * Worker: Get own orders
 */
exports.getUserOrders = async (req, res) => {
    const { userId } = req.params;

    if (!userId || userId === "null" || userId === "undefined") {
        throw new BadRequestError("Please provide userId");
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError(`No User found with id:${userId}`);

    const orders = await FoodOrders.find({ userId }).sort({ createdAt: -1 });

    const totalSpent = orders.reduce((sum, o) => sum + o.totalPrice, 0);

    console.log("\x1b[36m%s\x1b[0m", `${user.username} orders retrieved`);

    res.status(StatusCodes.OK).json({
        message: `${user.name} orders found`,
        nbHits: orders.length,
        totalSpent,
        orders,
    });
};


/**
 * Caterer/Admin: Get all orders
 */
exports.getAllOrders = async (req, res) => {
    const orders = await FoodOrders.find()
        .populate("mealId")
        .populate("userId", "firstName lastName email profile_picture_id");

    res.status(StatusCodes.OK).json({ nbHits: orders.length, orders });
};

/**
 * Admin: Get total money spent by everyone
 */
exports.getTotalSpent = async (req, res) => {
    const orders = await FoodOrders.find();
    const total = orders.reduce((sum, o) => sum + o.totalPrice, 0);

    res.status(StatusCodes.OK).json({ total });
};

/**
 * Delete order (Admin or the same Worker)
 */
exports.deleteOrder = async (req, res) => {
    const { orderId } = req.params;
    if (!orderId) throw new BadRequestError("Please provide orderId");

    const order = await FoodOrders.findOneAndDelete({ _id: new ObjectId(orderId) });
    if (!order) throw new NotFoundError(`No order found with id:${orderId}`);

    console.log("\x1b[31m%s\x1b[0m", `Order ${orderId} deleted`);

    res.status(StatusCodes.OK).json({ text: "Order deleted successfully!", order });
};

/**
 * Caterer/Admin: Update Order Status
 */
exports.updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!orderId) throw new BadRequestError("Please provide orderId");
    if (!status) throw new BadRequestError("Please provide a status");

    // ✅ Only allow valid status values
    const validStatuses = ["pending", "preparing", "completed"];
    if (!validStatuses.includes(status)) {
        throw new BadRequestError(
            `Invalid status. Allowed values: ${validStatuses.join(", ")}`
        );
    }

    const order = await FoodOrders.findById(orderId);
    if (!order) throw new NotFoundError(`No order found with id:${orderId}`);

    order.status = status;
    await order.save();

    console.log("\x1b[33m%s\x1b[0m", `Order ${orderId} status updated to ${status}`);

    res.status(StatusCodes.OK).json({ message: "Order status updated", order });
};

/* -------------------------------------------------
   NEW ENDPOINTS: ADMIN & CATERER DASHBOARDS
--------------------------------------------------- */

/**
 * Admin Dashboard Data
 */
exports.getAdminData = async (req, res) => {
    const users = await User.find({}, "firstName lastName email profilePic role profile_picture_id");
    const orders = await FoodOrders.find();

    // Group orders daily & cumulative
    const dailyMap = {};
    let cumulative = 0;

    orders.forEach((o) => {
        const dateKey = new Date(o.createdAt).toISOString().split("T")[0];
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { orders: 0, uniqueUsers: new Set() };
        dailyMap[dateKey].orders += 1;
        dailyMap[dateKey].uniqueUsers.add(o.userId.toString());
        cumulative++;
    });

    const dailyStats = Object.keys(dailyMap).map((date) => ({
        date,
        totalOrders: dailyMap[date].orders,
        uniquePeople: dailyMap[date].uniqueUsers.size,
    }));

    const userData = users.map((u) => {
        const userOrders = orders.filter((o) => o.userId.toString() === u._id.toString());
        return {
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            profilePic: u.profilePic || "",
            profile_picture_id: u.profile_picture_id || "",
            totalOrders: userOrders.length,
            cumulative,
        };
    });
    console.log(userData)

    res.status(StatusCodes.OK).json(userData);
};

/**
 * Caterer Dashboard Data
 */
exports.getCatererData = async (req, res) => {
    const orders = await FoodOrders.find().populate("userId", "firstName lastName role profile_picture_id");

    const mealMap = {};

    orders.forEach((o) => {
        if (!mealMap[o.mealName]) {
            mealMap[o.mealName] = { totalQuantity: 0, orderedBy: [] };
        }
        mealMap[o.mealName].totalQuantity += o.quantity;
        mealMap[o.mealName].orderedBy.push({
            name: `${o.userId.firstName} ${o.userId.lastName}`,
            role: o.userId.role,
        });
    });

    const mealData = Object.keys(mealMap).map((meal) => ({
        mealName: meal,
        totalQuantity: mealMap[meal].totalQuantity,
        orderedBy: mealMap[meal].orderedBy,
    }));

    res.status(StatusCodes.OK).json(mealData);
};




// ... your existing methods (createOrder, getUserOrders, etc.)

/**
 * Admin: get analytics data for dashboard.
 * Returns an object:
 * {
 *   users: [ { _id, name, email, profilePic, ordersCount, totalSpent } ],
 *   ordersByUser: [ { _id, name, profilePic, meals: [ { name, qty } ], totalMeals, feedback } ]
 * }
 */
exports.getAdminAnalytics = async (req, res) => {
  // Fetch all users
  const users = await User.find({}, "firstName lastName email profilePic profile_picture_id createdAt");

  // Fetch all orders, with feedback if you have a Feedback model
  const orders = await FoodOrders.find().lean(); // lean to get plain JS objects

  // If you have a Feedback model, load them too
  // e.g. const Feedback = require("../models/Feedback");
  // const feedbacks = await Feedback.find().lean();

  // Build a map of orders grouped by user
  const ordersByUserMap = {};

  orders.forEach((order) => {
    const uid = order.userId.toString();
    if (!ordersByUserMap[uid]) {
      ordersByUserMap[uid] = {
        _id: uid,
        meals: {},
        totalMeals: 0,
        // feedback boolean: you can decide logic; here default false
        feedback: false,
      };
    }
    const rec = ordersByUserMap[uid];
    // Count meal quantity
    const mealName = order.mealName || "Unknown";
    rec.meals[mealName] = (rec.meals[mealName] || 0) + order.quantity;
    rec.totalMeals += order.quantity;
    // TODO: check feedbacks to set feedback = true if any feedback exists for this order
  });

  // Convert meals map to array, assemble ordersByUser
  const ordersByUser = Object.values(ordersByUserMap).map((rec) => {
  const userOrders = orders.filter((o) => o.userId.toString() === rec._id);
  const latestOrderDate = userOrders.length
    ? new Date(Math.max(...userOrders.map(o => new Date(o.createdAt)))).toISOString().split("T")[0]
    : null;

  return {
    _id: rec._id,
    name: (() => {
      const u = users.find((u) => u._id.toString() === rec._id);
      return u ? `${u.firstName} ${u.lastName}` : "Unknown";
    })(),
    profilePic: (() => {
      const u = users.find((u) => u._id.toString() === rec._id);
      return u ? u.profilePic : "";
    })(),
    profile_picture_id: (() => {
      const u = users.find((u) => u._id.toString() === rec._id);
      return u ? u.profile_picture_id : "";
    })(),
    meals: Object.entries(rec.meals).map(([name, qty]) => ({
      name,
      qty,
    })),
    totalMeals: rec.totalMeals,
    feedback: rec.feedback,
    latestOrderDate,   // ✅ so React can group properly
  };
});


  // Build users overview
  // Build users overview
const usersOverview = users.map((u) => {
  const rec = ordersByUserMap[u._id.toString()] || { totalMeals: 0 };

  // find latest order for this user
  const userOrders = orders.filter((o) => o.userId.toString() === u._id.toString());
  const latestOrderDate = userOrders.length
    ? new Date(Math.max(...userOrders.map(o => new Date(o.createdAt)))).toISOString().split("T")[0]
    : null;

  return {
    _id: u._id.toString(),
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    profilePic: u.profilePic || "",
    profile_picture_id: u.profile_picture_id || "",
    ordersCount: rec.totalMeals,
    totalSpent: userOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0),
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,   // ✅ include user creation date
    latestOrderDate,                                            // ✅ include latest order date
  };
});

  res.status(StatusCodes.OK).json({
    users: usersOverview,
    ordersByUser,
  });
};

/**
 * Caterer: analytics grouped by date -> meals -> users who ordered
 */
exports.getCatererAnalytics = async (req, res) => {
  // Fetch all orders with user info
  const orders = await FoodOrders.find()
    .populate("userId", "firstName lastName profile_picture_id")
    .lean();

  // Group by date (ISO date string)
  const dateMap = {}; // dateKey => array of meal records

  orders.forEach((order) => {
    const dateKey = new Date(order.createdAt).toISOString().split("T")[0];
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {};
    }
    const mealName = order.mealName || "Unknown";

    if (!dateMap[dateKey][mealName]) {
      dateMap[dateKey][mealName] = {
        totalOrders: 0,
        users: new Set(),
      };
    }
    const rec = dateMap[dateKey][mealName];
    rec.totalOrders += order.quantity;
    rec.users.add(
      order.userId
        ? `${order.userId.firstName} ${order.userId.lastName}`
        : "Unknown"
    );
  });

  // Convert sets to arrays
  const result = {};
  for (const [date, mealObj] of Object.entries(dateMap)) {
    result[date] = Object.entries(mealObj).map(([mealName, rec]) => ({
      mealName,
      totalOrders: rec.totalOrders,
      users: Array.from(rec.users),
    }));
  }

  res.status(StatusCodes.OK).json(result);
};





const cutoffHour = 11; // 11 AM

function isBefore11AM() {
  const now = new Date();
  return now.getHours() < cutoffHour;
}

function isBeforeSunday11AM() {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() < cutoffHour;
}

/* ======================================================
   🧑‍🍳 Caterer: Set Weekly Menu (3+ meals per day)
====================================================== */
exports.setWeeklyMenu = async (req, res) => {
  const { weekStart, weekEnd, mealsByDay, createdBy } = req.body;

  if (!weekStart || !weekEnd || !mealsByDay || !createdBy)
    throw new BadRequestError("Missing required fields.");

  const user = await User.findById(createdBy);
  if (!user || user.role !== "caterer")
    throw new UnauthenticatedError("Only caterers can set the menu.");

  // Validate that each day has at least 3 meals
  const days = Object.keys(mealsByDay);
  for (const day of days) {
    const meals = mealsByDay[day];
    if (!Array.isArray(meals) || meals.length < 3) {
      throw new BadRequestError(`${day} must have at least 3 meals.`);
    }
  }

  const newMenu = new WeeklyMenu({
    weekStart,
    weekEnd,
    mealsByDay,
    createdBy,
  });

  await newMenu.save();
  res
    .status(StatusCodes.CREATED)
    .json({ message: "Weekly menu created successfully", menu: newMenu });
};

/* ======================================================
   👷 Worker/Admin: Create Weekly Order
====================================================== */
/* ======================================================
   👷 Worker/Admin: Create Weekly Order
   Each day (Mon–Sun) = ₵40 per meal
====================================================== */
exports.createWeeklyOrder = async (req, res) => {
  const { userId, weeklyMeals } = req.body; // { monday: mealId, ... }

  if (!userId || !weeklyMeals)
    throw new BadRequestError("Please provide userId and weeklyMeals");

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");

  const latestMenu = await WeeklyMenu.findOne().sort({ createdAt: -1 });
  if (!latestMenu)
    throw new BadRequestError("No weekly menu available yet.");

  const validDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  // ✅ Validate that each chosen meal belongs to weekly menu
  for (const day of validDays) {
    if (!weeklyMeals[day]) continue;
    const availableMeals = latestMenu.mealsByDay[day]?.map((id) =>
      id.toString()
    );
    if (!availableMeals || !availableMeals.includes(weeklyMeals[day].toString())) {
      throw new BadRequestError(`Meal chosen for ${day} is not in the current menu.`);
    }
  }

  // ✅ Prevent update after Sunday 11 AM unless admin
  if (!isBeforeSunday11AM() && user.role !== "admin") {
    throw new BadRequestError(
      "You can only update weekly orders before Sunday 11 AM."
    );
  }

  // ✅ Determine Monday–Sunday range
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(monday.getDate() - monday.getDay() + 1); // get Monday of this week
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ✅ Delete existing orders for that week (to replace)
  await FoodOrders.deleteMany({
    userId,
    createdAt: { $gte: monday, $lt: sunday },
  });

  // ✅ Create daily orders with ₵40 per day
  const fixedDailyPrice = 40;
  const createdOrders = [];

  for (const day of validDays) {
    const mealId = weeklyMeals[day];
    if (!mealId) continue;

    const meal = await Meal.findById(mealId);
    if (!meal) continue;

    const dateOfDay = new Date(monday);
    const offset = validDays.indexOf(day);
    dateOfDay.setDate(monday.getDate() + offset);

    const order = new FoodOrders({
      userId,
      mealId: meal._id,
      mealName: meal.name,
      quantity: 1,
      pricePerMeal: fixedDailyPrice,   // ✅ Fixed 40 cedis per meal
      totalPrice: fixedDailyPrice,
      orderedByRole: user.role,
      date: dateOfDay,
      createdAt: dateOfDay,
    });

    await order.save();
    createdOrders.push(order);
  }

  res.status(StatusCodes.CREATED).json({
    message: "Weekly order placed successfully (₵40/day)",
    createdOrders,
  });
};


/* ======================================================
   👷 Worker/Admin: Update Daily Order (before 11 AM)
====================================================== */
/* ======================================================
   👷 Worker/Admin: Update Daily Order (before 11 AM)
====================================================== */
exports.updateDailyOrder = async (req, res) => {
  const { userId, newMealId } = req.body;
  if (!userId || !newMealId)
    throw new BadRequestError("Please provide userId and newMealId");

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const order = await FoodOrders.findOne({
    userId,
    createdAt: { $gte: today, $lt: tomorrow },
  });

  if (!order) throw new NotFoundError("No order found for today");

  if (!isBefore11AM() && user.role !== "admin") {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: "You can no longer update today's order (past 11 AM).",
    });
  }

  const meal = await Meal.findById(newMealId);
  if (!meal) throw new NotFoundError("Meal not found");

  order.mealId = meal._id;
  order.mealName = meal.name;
  order.pricePerMeal = 40;    // ✅ Fixed 40 cedis per day
  order.totalPrice = 40;
  await order.save();

  res
    .status(StatusCodes.OK)
    .json({ message: "Daily order updated successfully (₵40)", order });
};
