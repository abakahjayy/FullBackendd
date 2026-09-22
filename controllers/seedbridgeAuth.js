const SeedBridgeUser = require("../models/SeedBridgeUser.js");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, UnauthenticatedError } = require("../errors");

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
        user: { userId: user._id, name: user.name, role: user.role, phone: user.phone },
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
        user: { userId: user._id, name: user.name, role: user.role, phone: user.phone },
    });
};

const getCurrentUser = async (req, res) => {
    const user = await SeedBridgeUser.findById(req.user.userId).select("-password");
    res.status(StatusCodes.OK).json({ user });
};

module.exports = { signUp, login, getCurrentUser };
