const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Fully isolated from the shared `User` model used by every other app on
// this backend - SeedBridge users sign up with a phone number (farmers in
// particular may have no email), not email+password, so this is its own
// collection rather than a schema change on the shared one.
const SeedBridgeUserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please enter your name"],
        },
        phone: {
            type: String,
            required: [true, "Please enter your phone number"],
            unique: true,
        },
        email: {
            type: String,
            sparse: true,
            unique: true,
        },
        password: {
            type: String,
            required: [true, "Please enter a password"],
            minlength: 6,
        },
        role: {
            type: String,
            enum: ["farmer", "buyer", "driver", "agent"],
            required: [true, "Please select a role"],
        },
        region: {
            type: String,
        },
        momoBalance: {
            type: Number,
            default: 0,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

SeedBridgeUserSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

SeedBridgeUserSchema.methods.createJWT = function () {
    return jwt.sign(
        { userId: this._id, name: this.name, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME }
    );
};

SeedBridgeUserSchema.methods.comparePasswords = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("SeedBridgeUser", SeedBridgeUserSchema);
