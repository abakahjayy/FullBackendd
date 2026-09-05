import jwt from "jsonwebtoken";
import User from "../models/User.js"; // assuming you already have this model

export const foodMiddleware = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>

            if (!token) {
                return res.status(401).json({ error: "No token provided, access denied" });
            }

            // ✅ Verify JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({ error: "User not found" });
            }

            // ✅ Role-based authorization
            if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ error: "Access denied" });
            }

            next(); // ✅ Continue to controller
        } catch (error) {
            console.error("Auth error:", error.message);
            return res.status(401).json({ error: "Invalid or expired token" });
        }
    };
};
