const express = require("express");
const mongoose = require("mongoose");
const Feedback = require("../models/FoodFeedback");
const { ObjectId } = require("mongodb");
const { UnauthenticatedError, BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const FoodOrders = require("../models/FoodOrders");

const router = express.Router();

/**
 * POST /api/v1/feedbacks
 * Public: Submit feedback for a completed order
 */
router.post("/", async (req, res) => {
    const { userId, orderId, eaten, delivered, comment } = req.body;

    if (!userId) throw new BadRequestError("Please provide userId");
    if (!orderId) throw new BadRequestError("Please provide orderId");
    if (eaten === undefined) throw new BadRequestError("Please specify if the meal was eaten");
    if (delivered === undefined) throw new BadRequestError("Please specify if the meal was delivered");

    // ✅ Validate user exists
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError(`No User found with id:${userId}`);

    // ✅ Validate order exists
    const order = await FoodOrders.findById(orderId);
    if (!order) throw new NotFoundError(`No Order found with id:${orderId}`);

    // ✅ Prevent duplicate feedback for same order
    const existing = await Feedback.findOne({ userId, orderId });
    if (existing) throw new BadRequestError("Feedback already submitted for this order");

    let feedback = new Feedback({
        userId,
        orderId,
        eaten,
        delivered,
        comment: comment || "",
    });

    await feedback.save();

    // ✅ Populate before sending to frontend
    feedback = await feedback.populate("userId", "firstName lastName email");

    console.log("\x1b[34m%s\x1b[0m", `Feedback submitted by ${user.firstName} for Order ${orderId}`);

    res.status(StatusCodes.CREATED).json({
        message: "Feedback submitted successfully",
        feedback,
    });
});

/**
 * GET /api/v1/feedbacks
 * Admin: Get all feedbacks
 */
router.get("/", async (req, res) => {
    const feedbacks = await Feedback.find()
        .populate("userId", "firstName lastName email")
        .populate("orderId");

    console.log("\x1b[36m%s\x1b[0m", `Retrieved ${feedbacks.length} feedbacks`);

    res.status(StatusCodes.OK).json({
        nbHits: feedbacks.length,
        feedbacks,
    });
});

/**
 * GET /api/v1/feedbacks/user/:userId
 * Worker: Get feedbacks for a specific user (e.g. worker sees only their orders' feedback)
 */
router.get("/user/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) throw new BadRequestError("Please provide userId");

    const feedbacks = await Feedback.find({ userId })
        .populate("userId", "firstName lastName email")
        .populate("orderId");

    console.log("\x1b[36m%s\x1b[0m", `Retrieved ${feedbacks.length} feedbacks for user ${userId}`);

    res.status(StatusCodes.OK).json({
        nbHits: feedbacks.length,
        feedbacks,
    });
});

/**
 * PATCH /api/v1/feedbacks/:id
 * Update an existing feedback
 */
router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    if (!id) throw new BadRequestError("Please provide feedback id");

    const updatedFeedback = await Feedback.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
    )
        .populate("userId", "firstName lastName email")
        .populate("orderId");

    if (!updatedFeedback) throw new NotFoundError(`No feedback found with id:${id}`);

    console.log("\x1b[33m%s\x1b[0m", `Feedback ${id} updated successfully`);

    res.status(StatusCodes.OK).json({
        message: "Feedback updated successfully",
        feedback: updatedFeedback,
    });
});

/**
 * DELETE /api/v1/feedbacks/:id
 * Admin: Delete a feedback
 */
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    if (!id) throw new BadRequestError("Please provide feedback id");

    const feedback = await Feedback.findOneAndDelete({ _id: new ObjectId(id) });
    if (!feedback) throw new NotFoundError(`No feedback found with id:${id}`);

    console.log("\x1b[31m%s\x1b[0m", `Feedback ${id} deleted`);

    res.status(StatusCodes.OK).json({
        message: "Feedback deleted successfully",
        feedback,
    });
});

module.exports = router;
