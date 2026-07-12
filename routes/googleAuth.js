const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Import your User model
const router = express.Router();

// Route to start Google Auth
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback route for Google Auth
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false }),
    async (req, res) => {
        const { id, email,fullName, photoURL } = req.user;
        console.log(req.user)

        // Check if the user already exists in the database
        let user = await User.findOne({ email });

        if (!user) {
            // If the user doesn't exist, create a new user
            const username = email.split("@")[0]; // Default username is the part before the @ symbol
            user = new User({
                firstName: fullName.split(" ")[0], // Assuming the first name is the first part of the display name
                lastName: fullName.split(" ")[1] || "", // Assuming the last name is the second part of the display name
                username,
                email,
                password: "password123", // You can set a strong password for production
                profile_picture: photoURL,
                profile_picture_id: photoURL,
                followers:[],
                following: [],
                posts:[],
                bio: "This is your bio. Add something interesting!",
                isVerified: true, // You can set this based on your app logic
            });
            await user.save();
        }

        // Generate a JWT token for the authenticated user
        const token = jwt.sign(
            { id: user._id, email: user.email, fullName: user.firstName + " " + user.lastName ,password:"password123"},
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Set the JWT as a cookie
        res.cookie("token", token, { httpOnly: true });

        // Redirect to the frontend after successful authentication
        res.redirect(process.env.REDIRECT_URL); // Redirect to your React app
    }
);

module.exports = router;
