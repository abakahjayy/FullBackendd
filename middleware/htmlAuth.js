const jwt = require('jsonwebtoken');
const User = require('../models/User');

const htmlAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token || req.query.oven;

    if (!token || token === 'undefined') {
      return res.redirect('/api/v1/bundle/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.redirect('/api/v1/bundle/login');
    }

    // Attach user if needed
    req.user = user;
    next();
  } catch (err) {
    return res.redirect('/api/v1/bundle/login');
  }
};

module.exports = htmlAuth;
