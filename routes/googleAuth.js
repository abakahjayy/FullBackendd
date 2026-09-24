const express = require("express");
const passport = require("passport");
const crypto = require("crypto");
const User = require("../models/User");
const seedStarterTransactions = require("../utils/seedStarterTransactions");
const { googleCallback: cleanbridgeGoogleCallback } = require("../controllers/cleanbridgeAuth");
const {
    isAllowedRedirectUri,
    isAllowedCleanbridgeRedirect,
    isWellFormedHttpUrl,
    appendQueryParam,
    encodeOAuthState,
    decodeOAuthState,
} = require("../utils/oauthRedirect");
const router = express.Router();

// Default target when a caller doesn't pass its own redirect_uri, kept for
// backwards compatibility with the original single-app integration.
const DEFAULT_REDIRECT_URI = process.env.REDIRECT_URL
    ? `${process.env.REDIRECT_URL}/auth/callback`
    : undefined;

// Any frontend app - any site at all, no .env edit or registration step -
// can kick off login by hitting this route with its own
// ?redirect_uri=<where it wants the token sent back to>.
//
// SECURITY NOTE: by explicit request, this does NOT check redirect_uri
// against an allowlist (contrast with controllers/seedbridgePayment.js,
// which still does via isAllowedRedirectUri). That means this route is an
// open redirect: anyone can craft
// /auth/google?redirect_uri=https://attacker.example and a victim who
// clicks it and completes a real Google login will have their login token
// sent to attacker.example. Re-adding isAllowedRedirectUri here (swap the
// import below) closes that hole at the cost of requiring each real
// frontend's domain to be added to ALLOWED_REDIRECT_DOMAINS in .env.
router.get("/google", (req, res, next) => {
    // CleanBridge GH signs users into its own CleanBridgeUser collection, and
    // (unlike the open flow below) only ever sends tokens to hosts on
    // ALLOWED_REDIRECT_DOMAINS. ?role=collector lets collectors sign up with Google.
    if (req.query.app === "cleanbridge") {
        const redirectUri = req.query.redirect_uri;
        if (!isAllowedCleanbridgeRedirect(redirectUri)) {
            return res.status(400).json({
                msg: "Missing or disallowed redirect_uri. Add its domain to ALLOWED_REDIRECT_DOMAINS in .env.",
            });
        }
        const role = req.query.role === "collector" ? "collector" : "customer";
        return passport.authenticate("google", {
            scope: ["profile", "email"],
            prompt: "select_account",
            state: encodeOAuthState({ redirectUri, app: "cleanbridge", role }),
        })(req, res, next);
    }

    const redirectUri = req.query.redirect_uri || DEFAULT_REDIRECT_URI;

    if (!redirectUri || !isWellFormedHttpUrl(redirectUri)) {
        return res.status(400).json({
            msg: "Missing or invalid redirect_uri.",
        });
    }

    passport.authenticate("google", {
        scope: ["profile", "email"],
        state: encodeOAuthState({ redirectUri }),
    })(req, res, next);
});

// CleanBridge: if the user cancels on Google's consent screen, Google calls
// back with ?error=access_denied - send them back to the app with that error
// instead of a bare 401 page.
const cleanbridgeCancelled = (req, res, next) => {
    const state = decodeOAuthState(req.query.state);
    if (req.query.error && state?.app === "cleanbridge" && isAllowedCleanbridgeRedirect(state.redirectUri)) {
        return res.redirect(appendQueryParam(state.redirectUri, "error", "Google sign-in was cancelled."));
    }
    return next();
};

router.get(
    "/google/callback",
    cleanbridgeCancelled,
    passport.authenticate("google", { session: false }),
    async (req, res) => {
        const cleanbridgeState = decodeOAuthState(req.query.state);
        if (cleanbridgeState?.app === "cleanbridge") {
            return cleanbridgeGoogleCallback(req, res, cleanbridgeState);
        }

        // utils/passport.js hands back { id, email, fullName, profilePic } -
        // this used to destructure a nonexistent `photoURL` field, so the
        // real Google photo was silently dropped in favor of the schema's
        // placeholder default.
        const { email, fullName, profilePic } = req.user;

        let user = await User.findOne({ email });

        if (!user) {
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const username = email.split("@")[0];
            user = new User({
                firstName: fullName.split(" ")[0],
                lastName: fullName.split(" ")[1] || "",
                username,
                email,
                password: randomPassword,
                role: "worker",
                profile_picture: profilePic,
                followers: [],
                following: [],
                posts: [],
                bio: "This is your bio. Add something interesting!",
                isVerified: true,
            });
            await user.save();
            await seedStarterTransactions(user._id);
        } else if (profilePic && user.profile_picture !== profilePic) {
            // Keep the photo in sync with Google on every login - this also
            // self-heals accounts created before this field was wired up
            // correctly (they're stuck on the placeholder otherwise).
            user.profile_picture = profilePic;
            await user.save();
        }

        const token = user.createJWT();

        res.cookie("token", token, { httpOnly: true });

        const state = decodeOAuthState(req.query.state);
        const redirectUri =
            state && isWellFormedHttpUrl(state.redirectUri)
                ? state.redirectUri
                : DEFAULT_REDIRECT_URI;

        if (!redirectUri) {
            return res.status(400).json({ msg: "No valid redirect_uri for this login request." });
        }

        res.redirect(appendQueryParam(redirectUri, "token", token));
    }
);

module.exports = router;
// const express = require("express");
// const passport = require("passport");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User"); // Import your User model
// const router = express.Router();

// // Route to start Google Auth
// router.get(
//     "/google",
//     passport.authenticate("google", { scope: ["profile", "email"] })
// );

// // Callback route for Google Auth
// router.get(
//     "/google/callback",
//     passport.authenticate("google", { session: false }),
//     async (req, res) => {
//         const { id, email,fullName, photoURL } = req.user;
//         console.log(req.user)

//         // Check if the user already exists in the database
//         let user = await User.findOne({ email });

//         if (!user) {
//             // If the user doesn't exist, create a new user
//             const username = email.split("@")[0]; // Default username is the part before the @ symbol
//             user = new User({
//                 firstName: fullName.split(" ")[0], // Assuming the first name is the first part of the display name
//                 lastName: fullName.split(" ")[1] || "", // Assuming the last name is the second part of the display name
//                 username,
//                 email,
//                 password: "password123", // You can set a strong password for production
//                 profile_picture: photoURL,
//                 profile_picture_id: photoURL,
//                 followers:[],
//                 following: [],
//                 posts:[],
//                 bio: "This is your bio. Add something interesting!",
//                 isVerified: true, // You can set this based on your app logic
//             });
//             await user.save();
//         }

//         // Generate a JWT token for the authenticated user
//         const token = jwt.sign(
//             { id: user._id, email: user.email, fullName: user.firstName + " " + user.lastName ,password:"password123"},
//             process.env.JWT_SECRET,
//             { expiresIn: "30d" }
//         );

//         // Set the JWT as a cookie
//         res.cookie("token", token, { httpOnly: true });

//         // Redirect to the frontend after successful authentication
//         res.redirect(`${process.env.REDIRECT_URL}?token=${token}`); // Redirect to your React app
//     }
// );

// module.exports = router;
