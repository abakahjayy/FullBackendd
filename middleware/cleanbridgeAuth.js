const jwt = require("jsonwebtoken");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { UnauthenticatedError, UnauthorizedError } = require("../errors");

// Mirrors middleware/seedbridgeAuth.js, but resolves against CleanBridgeUser
// and requires the `app: "cleanbridge"` claim - a token minted for the
// shared User model or for SeedBridge can never authenticate here.
const cleanbridgeAuthMiddleware = async (req, res, next) => {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.cleanbridgeToken) {
        token = req.cookies.cleanbridgeToken;
    }

    if (!token || token === "undefined") {
        throw new UnauthenticatedError("No valid token provided.");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new UnauthenticatedError(`Not authorized: ${error.message}`);
    }

    if (decoded.app !== "cleanbridge") {
        throw new UnauthenticatedError("Not authorized: token was not issued by CleanBridge.");
    }

    const user = await CleanBridgeUser.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) {
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
};

// Usage: router.get('/x', cleanbridgeAuth, requireRole('admin'), handler)
const requireRole = (...roles) => {
    const guard = (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new UnauthorizedError(`Access denied. Requires role: ${roles.join(" or ")}`);
        }
        next();
    };
    guard.roles = roles; // shown in the API docs (utils/apiDocs.js)
    return guard;
};

module.exports = cleanbridgeAuthMiddleware;
module.exports.requireRole = requireRole;
