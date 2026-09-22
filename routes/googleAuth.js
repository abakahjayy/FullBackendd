const express = require("express");
const passport = require("passport");
const crypto = require("crypto");
const User = require("../models/User");
const {
    isAllowedRedirectUri,
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

// Any frontend app can kick off login by hitting this route with its own
// ?redirect_uri=<where it wants the token sent back to>. No prior
// registration is needed - the URL just has to resolve to a host in
// ALLOWED_REDIRECT_DOMAINS (see utils/oauthRedirect.js).
router.get("/google", (req, res, next) => {
    const redirectUri = req.query.redirect_uri || DEFAULT_REDIRECT_URI;

    if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
        return res.status(400).json({
            msg: "Missing or disallowed redirect_uri. Add its domain to ALLOWED_REDIRECT_DOMAINS in .env.",
        });
    }

    passport.authenticate("google", {
        scope: ["profile", "email"],
        state: encodeOAuthState({ redirectUri }),
    })(req, res, next);
});

router.get(
    "/google/callback",
    passport.authenticate("google", { session: false }),
    async (req, res) => {
        const { id, email, fullName, photoURL } = req.user;

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
                profile_picture: photoURL,
                profile_picture_id: photoURL,
                followers: [],
                following: [],
                posts: [],
                bio: "This is your bio. Add something interesting!",
                isVerified: true,
            });
            await user.save();
        }

        const token = user.createJWT();

        res.cookie("token", token, { httpOnly: true });

        const state = decodeOAuthState(req.query.state);
        const redirectUri =
            state && isAllowedRedirectUri(state.redirectUri)
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
