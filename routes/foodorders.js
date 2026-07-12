const express = require("express");
const router = express.Router();
const {
  createOrder,
  getUserOrders,
  getAllOrders,
  getTotalSpent,
  deleteOrder,
  updateOrderStatus,
  getAdminData,          // ✅ Old reference (kept for safety)
  getCatererData,
  getAdminAnalytics,
  getCatererAnalytics,   // ✅ New controller
  setWeeklyMenu,         // 🆕 Caterer: set weekly meals
  createWeeklyOrder,     // 🆕 User/Admin: place weekly order
  updateDailyOrder,      // 🆕 User/Admin: update daily order
} = require("../controllers/foodorders");

// ======================================================
// 📦 EXISTING ROUTES
// ======================================================

// Create new order (Worker/Admin)
router.post("/", createOrder);

// Get own orders (Worker/Admin)
router.get("/user/:userId", getUserOrders);

// Get all orders (Caterer/Admin)
router.get("/all", getAllOrders);

// Get total money spent (Admin)
router.get("/total", getTotalSpent);

// ✅ Admin-only: analytics (users, orders grouped daily, cumulative sum)
router.get("/admin-data", getAdminAnalytics);

// ✅ Caterer-only: grouped orders by meal
router.get("/caterer-data", getCatererAnalytics);

// Update order status (Caterer/Admin)
router.patch("/:orderId/status", updateOrderStatus);

// Delete order (Admin or Worker for own order)
router.delete("/:orderId", deleteOrder);

// ======================================================
// 🧑‍🍳 NEW ROUTES: Weekly/Daily Meal Management
// ======================================================

// 🧾 Caterer: Set weekly menu (3+ meals per day)
router.post("/weekly-menu", setWeeklyMenu);

// 👷 Worker/Admin: Create weekly order (before Sunday 11 AM)
router.post("/weekly-order", createWeeklyOrder);

// 👷 Worker/Admin: Update today's order (before 11 AM)
router.patch("/daily-order", updateDailyOrder);

module.exports = router;
