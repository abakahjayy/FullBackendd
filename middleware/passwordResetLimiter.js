const rateLimiter = require("express-rate-limit");

// Forgot/reset password endpoints send emails and check secrets - keep them
// from being used to spam inboxes or guess tokens. Counted per IP *and* per
// app (the mount path), so one app's traffic can't use up another's budget.
const perApp = (req) => `${req.ip}|${req.baseUrl}`;
const message = { msg: "Too many password reset attempts. Please try again in 15 minutes." };

// Sending reset emails: strict.
const forgotLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: perApp, standardHeaders: true, legacyHeaders: false, message });
// Submitting a new password: looser (typos happen), still blocks token guessing.
const resetLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 20, keyGenerator: perApp, standardHeaders: true, legacyHeaders: false, message });

module.exports = { forgotLimiter, resetLimiter };
