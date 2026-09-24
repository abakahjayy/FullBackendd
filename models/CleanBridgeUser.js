const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { normalizeGhanaPhone, REGIONS } = require("../utils/ghana.js");

const PointSchema = new mongoose.Schema(
    { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    { _id: false }
);

// Fully isolated from the shared `User` model (and from SeedBridgeUser) -
// CleanBridge GH customers, collectors and operations admins live in their
// own collection with their own roles.
const CleanBridgeUserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please enter your name"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Please enter your email"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        // Optional for Google sign-ups until they complete their profile.
        // Stored normalized as +233XXXXXXXXX. Sparse so missing phones don't collide.
        phone: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        // Not required for Google-only accounts.
        password: {
            type: String,
            required: [function () { return !this.googleId; }, "Please enter a password"],
            minlength: 6,
        },
        googleId: { type: String, unique: true, sparse: true },
        avatarUrl: { type: String, default: null },
        avatarSource: { type: String, enum: ["google", "upload", null], default: null },
        avatarFileId: { type: String, default: null }, // ImageKit file id for uploads
        googleAvatarUrl: { type: String, default: null },
        role: {
            type: String,
            enum: ["customer", "collector", "admin"],
            default: "customer",
        },
        area: { type: String, default: null },
        address: { type: String, default: null },
        region: { type: String, enum: [...REGIONS, null], default: null },
        ghanaPostGps: { type: String, default: null },
        location: { type: PointSchema, default: null },
        // --- collector-only fields ---
        collectorStatus: {
            type: String,
            enum: ["available", "on_route", "off_duty"],
            default: "off_duty",
        },
        lastLocation: {
            lat: Number,
            lng: Number,
            updatedAt: Date,
        },
        momoNumber: { type: String, default: null },
        momoNetwork: { type: String, enum: ["MTN", "Telecel", "AirtelTigo", null], default: null },
        rating: { type: Number, default: null },
        ratingCount: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        // Email updates (pickup status, payments, payouts). Turned off by the
        // unsubscribe link or the profile toggle.
        emailNotifications: { type: Boolean, default: true },
    },
    { timestamps: true }
);

CleanBridgeUserSchema.pre("validate", function (next) {
    if (this.isModified("phone") && this.phone) {
        const normalized = normalizeGhanaPhone(this.phone);
        if (!normalized) {
            this.invalidate("phone", "Enter a valid Ghana mobile number, e.g. 024 123 4567");
        } else {
            this.phone = normalized;
        }
    }
    if (this.isModified("momoNumber") && this.momoNumber) {
        const normalized = normalizeGhanaPhone(this.momoNumber);
        if (!normalized) this.invalidate("momoNumber", "Enter a valid Ghana mobile money number");
        else this.momoNumber = normalized;
    }
    next();
});

CleanBridgeUserSchema.pre("save", async function (next) {
    if (this.isModified("password") && this.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

CleanBridgeUserSchema.methods.createJWT = function () {
    return jwt.sign(
        { userId: this._id, name: this.name, role: this.role, app: "cleanbridge" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME }
    );
};

CleanBridgeUserSchema.methods.comparePasswords = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("CleanBridgeUser", CleanBridgeUserSchema);
