const SeedBridgeUser = require("../models/SeedBridgeUser.js");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, UnauthenticatedError } = require("../errors");

// Matches the `User` schema in lib/api-spec/openapi.yaml on the SeedBridge
// frontend exactly (id, not _id/userId) - the frontend's generated types
// and hooks (e.g. FarmerListings.jsx's `user?.id`) are built against that
// contract, so drifting from it here silently breaks queries that gate on
// `user.id` being present.
const toUserDTO = (user) => ({
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    email: user.email ?? null,
    role: user.role,
    region: user.region ?? null,
    avatarUrl: null,
    rating: null,
    totalRatings: 0,
    momoBalance: user.momoBalance ?? 0,
    createdAt: user.createdAt,
});

const signUp = async (req, res) => {
    const { name, phone, password, role, email, region } = req.body;

    if (!name || !phone || !password || !role) {
        throw new BadRequestError("Please provide name, phone, password and role");
    }

    const user = await SeedBridgeUser.create({ name, phone, password, role, email, region });
    const token = user.createJWT();

    res.status(StatusCodes.CREATED).json({
        message: "Account created successfully!",
        token,
        user: toUserDTO(user),
    });
};

const login = async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        throw new BadRequestError("Please provide phone and password");
    }

    const user = await SeedBridgeUser.findOne({ phone });
    if (!user) {
        throw new UnauthenticatedError("Invalid phone number or password");
    }

    const isPasswordCorrect = await user.comparePasswords(password);
    if (!isPasswordCorrect) {
        throw new UnauthenticatedError("Invalid phone number or password");
    }

    const token = user.createJWT();

    res.status(StatusCodes.OK).json({
        message: "Login successful!",
        token,
        user: toUserDTO(user),
    });
};

const getCurrentUser = async (req, res) => {
    const user = await SeedBridgeUser.findById(req.user.userId).select("-password");
    res.status(StatusCodes.OK).json({ user: toUserDTO(user) });
};

module.exports = { signUp, login, getCurrentUser };
