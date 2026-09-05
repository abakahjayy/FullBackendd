const User = require('../models/User.js');
const { UnauthenticatedError } = require('../errors');

const adminOnly = async (req, res, next) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            throw new UnauthenticatedError('User ID not found in request. Unauthorized access.');
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new UnauthenticatedError('User not found.');
        }

        if (user.role !== 'admin') {
            throw new UnauthenticatedError('Access denied. Admins only.');
        }

        console.log(`🛡️ Admin access granted to: ${user.username}`);
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = adminOnly;
