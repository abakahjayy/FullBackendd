const jwt = require("jsonwebtoken");
const SeedBridgeUser = require("../models/SeedBridgeUser.js");
const { UnauthenticatedError } = require("../errors");

// Mirrors middleware/auth.js's token lookup, but resolves against
// SeedBridgeUser instead of the shared User model - a token minted for one
// can never be used to authenticate as the other.
const seedbridgeAuthMiddleware = async (req, res, next) => {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.seedbridgeToken) {
        token = req.cookies.seedbridgeToken;
    }

    if (!token || token === "undefined") {
        throw new UnauthenticatedError("No valid token provided.");
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { userId } = decoded;

        const user = await SeedBridgeUser.findById(userId).select("-password");
        if (!user) {
            throw new UnauthenticatedError("User not found.");
        }

        req.user = {
            userId: user._id,
            name: user.name,
            username: user.name,
            role: user.role,
            token,
        };
        next();
    } catch (error) {
        throw new UnauthenticatedError(`Not authorized: ${error.message}`);
    }
};

module.exports = seedbridgeAuthMiddleware;
