const crypto = require("crypto");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const { isAllowedRedirectUri, appendQueryParam } = require("./oauthRedirect");

// Forgot / reset password for ANY app on this backend, automatically.
//
// Every app gets the same two endpoints (mounted per user collection):
//   POST <base>/forgot-password  { email, redirect_uri? }
//   POST <base>/reset-password/:token?email=...  { newPassword }   (token/email may also be in the body)
//
// The emailed link goes to the calling app's own reset page when it passes
// `redirect_uri` (like Google login), or to this backend's hosted page
// (/resetPassword?app=<key>) when it doesn't - so an app with no reset screen
// of its own still works with zero setup. The link gets ?token=&email=
// appended. Because the link carries a secret, redirect_uri must be on
// ALLOWED_REDIRECT_DOMAINS (or pass the app's own isAllowedRedirect).
//
// Security: tokens are random 32-byte values stored only as SHA-256 hashes,
// expire after 30 minutes and are single-use; the forgot endpoint answers the
// same whether or not the email exists, so it can't be used to find accounts.

const TOKEN_TTL_MS = 30 * 60 * 1000;
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const backendOrigin = () => (process.env.ORIGIN || "http://localhost:7004").replace(/\/$/, "");

// Plain, spam-filter-friendly email used by apps without their own mailer.
const defaultEmail = ({ appName, name, link }) => ({
    subject: `Reset your ${appName} password`,
    text: [
        `Hi ${name || "there"},`,
        "",
        `We received a request to reset the password for your ${appName} account.`,
        `Open this link within 30 minutes to choose a new password:`,
        link,
        "",
        "If you didn't ask for this, you can ignore this email - your password won't change.",
    ].join("\n"),
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#1b2d2f;line-height:1.6">
  <h2 style="margin:0 0 12px">Reset your ${escapeHtml(appName)} password</h2>
  <p>Hi ${escapeHtml(name || "there")},</p>
  <p>We received a request to reset the password for your ${escapeHtml(appName)} account. This link works for 30 minutes and can be used once.</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#21927b;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:bold">Choose a new password</a></p>
  <p style="font-size:13px;color:#6b7c7e">If the button doesn't work, copy this link: <br>${escapeHtml(link)}</p>
  <p style="font-size:13px;color:#6b7c7e">If you didn't ask for this, ignore this email - your password won't change.</p>
</div>`,
});

/**
 * @param {object}   opts
 * @param {Model}    opts.Model            mongoose model with email/password + resetPasswordToken/resetPasswordExpires
 * @param {string}   opts.appKey           used for the hosted page (?app=)
 * @param {string}   opts.appName          shown in the email
 * @param {Function} opts.send             async ({ user, email, subject, text, html, link }) => void
 * @param {Function} [opts.displayName]    user => name for the greeting
 * @param {Function} [opts.isAllowedRedirect] url => boolean (default: ALLOWED_REDIRECT_DOMAINS)
 * @param {Function} [opts.defaultRedirect] () => url used when the caller passes none
 * @param {Function} [opts.beforeReset]    async (user) => void, e.g. extra checks
 */
const createPasswordReset = ({
    Model,
    appKey,
    appName,
    send,
    displayName = (u) => u.name || u.firstName || u.username,
    isAllowedRedirect = isAllowedRedirectUri,
    defaultRedirect = () => `${backendOrigin()}/resetPassword?app=${appKey}`,
    beforeReset,
}) => {
    const findByEmail = (email) => Model.findOne({ email: new RegExp(`^${escapeRegex(String(email).trim())}$`, "i") });

    const forgotPassword = async (req, res) => {
        const email = String(req.body.email || "").trim();
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestError("Please provide a valid email address");

        const requested = req.body.redirect_uri || req.body.redirectUri || req.query.redirect_uri;
        if (requested && !isAllowedRedirect(requested)) {
            throw new BadRequestError("redirect_uri is not an allowed domain. Add it to ALLOWED_REDIRECT_DOMAINS in .env.");
        }
        const redirect = requested || defaultRedirect();

        const user = await findByEmail(email);
        if (user && user.isActive !== false) {
            const token = crypto.randomBytes(32).toString("hex");
            user.resetPasswordToken = hashToken(token);
            user.resetPasswordExpires = new Date(Date.now() + TOKEN_TTL_MS);
            await user.save({ validateBeforeSave: false });

            const link = appendQueryParam(appendQueryParam(redirect, "token", token), "email", user.email);
            const content = defaultEmail({ appName, name: displayName(user), link });
            // Background send: the response time must not reveal whether the account exists.
            setImmediate(() => Promise.resolve(send({ user, email: user.email, link, ...content }))
                .catch((err) => console.error(`${appKey} reset email failed:`, err.message)));
        }

        res.status(StatusCodes.OK).json({
            message: "If an account exists for that email, a password reset link has been sent.",
        });
    };

    const resetPassword = async (req, res) => {
        const token = req.params.token || req.body.token;
        const email = req.query.email || req.body.email;
        const newPassword = req.body.newPassword || req.body.password;

        if (!token || !email) throw new BadRequestError("This reset link is incomplete. Request a new one.");
        if (!newPassword || String(newPassword).length < 6) throw new BadRequestError("Password must be at least 6 characters");

        const user = await Model.findOne({
            email: new RegExp(`^${escapeRegex(String(email).trim())}$`, "i"),
            // Also accept tokens issued before hashing was introduced.
            resetPasswordToken: { $in: [hashToken(token), String(token)] },
            resetPasswordExpires: { $gt: new Date() },
        });
        // 400 rather than 401: frontends treat 401 as "session expired".
        if (!user) throw new BadRequestError("This reset link is invalid or has expired. Request a new one.");
        if (beforeReset) await beforeReset(user);

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(StatusCodes.OK).json({ message: "Your password has been reset. You can now log in." });
    };

    return { forgotPassword, resetPassword };
};

module.exports = { createPasswordReset, hashToken };
