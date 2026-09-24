const ImageKit = require("imagekit");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, UnauthenticatedError, UnauthorizedError } = require("../errors");
const { toUserDTO } = require("../utils/cleanbridge.js");
const {
    REGIONS, normalizeGhanaPhone, detectNetwork, normalizeGhanaPostGps, isInGhana,
} = require("../utils/ghana.js");
const { appendQueryParam, isAllowedCleanbridgeRedirect } = require("../utils/oauthRedirect.js");
const { notify } = require("../utils/cleanbridgeNotify.js");

const welcome = (user) => notify(user._id, "Welcome to CleanBridge GH",
    user.role === "collector"
        ? "Your collector account is ready. Register your vehicle so our team can verify it, then start accepting pickups near you."
        : "Your account is ready. Book your first pickup in a minute - we show the price before you confirm, and you can pay with Mobile Money, card or cash.",
    { ctaPath: user.role === "collector" ? "/collector/vehicle" : "/pickup", ctaLabel: user.role === "collector" ? "Register vehicle" : "Book a pickup" });

const imagekit = process.env.IMAGE_KIT_PUBLIC_KEY && process.env.IMAGE_KIT_PRIVATE_KEY && process.env.IMAGE_KIT_ENDPOINT
    ? new ImageKit({
        publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
        privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
        urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
    })
    : null;

// Google serves a 96px avatar by default; ask for a sharper one.
const largerGooglePhoto = (url) => (url ? url.replace(/=s\d+-c$/, "=s256-c") : null);

// =========================
// POST /auth/signup
// =========================
// Anyone can sign up as a customer or collector. Creating an admin requires
// the `adminKey` to match CLEANBRIDGE_ADMIN_SIGNUP_KEY - if that env var is
// unset, admin signup is disabled entirely.
const signUp = async (req, res) => {
    const { name, email, phone, password, role = "customer", area, address, adminKey } = req.body;

    if (!name || !email || !phone || !password) {
        throw new BadRequestError("Please provide name, email, phone and password");
    }
    if (!["customer", "collector", "admin"].includes(role)) {
        throw new BadRequestError("Role must be customer, collector or admin");
    }
    if (role === "admin") {
        const expected = process.env.CLEANBRIDGE_ADMIN_SIGNUP_KEY;
        if (!expected || adminKey !== expected) {
            throw new UnauthorizedError("Admin accounts require a valid admin key");
        }
    }
    if (!normalizeGhanaPhone(phone)) {
        throw new BadRequestError("Enter a valid Ghana mobile number, e.g. 024 123 4567");
    }

    const user = await CleanBridgeUser.create({
        name, email, phone, password, role, area, address,
        // Collectors are paid to their own MoMo number by default.
        ...(role === "collector" ? { momoNumber: phone, momoNetwork: detectNetwork(phone) } : {}),
    });
    const token = user.createJWT();
    await welcome(user);

    res.status(StatusCodes.CREATED).json({
        message: "Account created successfully!",
        token,
        user: toUserDTO(user),
    });
};

// =========================
// POST /auth/login   { identifier (email or phone) | email | phone, password }
// =========================
const login = async (req, res) => {
    const { password } = req.body;
    const identifier = (req.body.identifier || req.body.email || req.body.phone || "").trim();

    if (!identifier || !password) {
        throw new BadRequestError("Please provide your email (or phone) and password");
    }

    const phone = normalizeGhanaPhone(identifier);
    const user = await CleanBridgeUser.findOne(
        phone ? { phone } : { email: identifier.toLowerCase() }
    );
    if (!user || !user.isActive) {
        throw new UnauthenticatedError("Invalid credentials");
    }
    if (!user.password) {
        throw new UnauthenticatedError("This account uses Google sign-in. Continue with Google instead.");
    }

    const isPasswordCorrect = await user.comparePasswords(password);
    if (!isPasswordCorrect) {
        throw new UnauthenticatedError("Invalid credentials");
    }

    res.status(StatusCodes.OK).json({
        message: "Login successful!",
        token: user.createJWT(),
        user: toUserDTO(user),
    });
};

// =========================
// GET /auth/me
// =========================
const getCurrentUser = async (req, res) => {
    const user = await CleanBridgeUser.findById(req.user.userId).select("-password");
    res.status(StatusCodes.OK).json({ user: toUserDTO(user) });
};

// =========================
// PATCH /auth/me   (profile page)
// =========================
const updateCurrentUser = async (req, res) => {
    const user = await CleanBridgeUser.findById(req.user.userId);
    const body = req.body;

    ["name", "area", "address"].forEach((field) => {
        if (body[field] !== undefined) user[field] = body[field] || null;
    });
    if (body.name !== undefined && !String(body.name).trim()) {
        throw new BadRequestError("Name cannot be empty");
    }

    if (body.phone !== undefined) {
        if (!normalizeGhanaPhone(body.phone)) {
            throw new BadRequestError("Enter a valid Ghana mobile number, e.g. 024 123 4567");
        }
        user.phone = body.phone;
    }

    if (body.region !== undefined) {
        if (body.region && !REGIONS.includes(body.region)) throw new BadRequestError("Unknown region");
        user.region = body.region || null;
    }

    if (body.ghanaPostGps !== undefined) {
        const gps = normalizeGhanaPostGps(body.ghanaPostGps);
        if (gps === undefined) throw new BadRequestError("GhanaPost GPS address looks like GA-183-8164");
        user.ghanaPostGps = gps;
    }

    if (body.location !== undefined) {
        if (body.location === null) {
            user.location = null;
        } else {
            const lat = Number(body.location.lat);
            const lng = Number(body.location.lng);
            if (!isInGhana(lat, lng)) throw new BadRequestError("Location must be in Ghana");
            user.location = { lat, lng };
        }
    }

    if (body.collectorStatus !== undefined || body.momoNumber !== undefined) {
        if (user.role !== "collector") {
            throw new BadRequestError("Only collectors have a work status and payout number");
        }
        if (body.collectorStatus !== undefined) user.collectorStatus = body.collectorStatus;
        if (body.momoNumber !== undefined) {
            const network = detectNetwork(body.momoNumber);
            if (!normalizeGhanaPhone(body.momoNumber) || !network) {
                throw new BadRequestError("Enter a valid MTN, Telecel or AirtelTigo number");
            }
            user.momoNumber = body.momoNumber;
            user.momoNetwork = network;
        }
    }

    if (body.emailNotifications !== undefined) {
        user.emailNotifications = Boolean(body.emailNotifications);
    }

    if (body.newPassword) {
        // Google-only accounts may set a first password without a current one.
        if (user.password) {
            const ok = await user.comparePasswords(body.currentPassword || "");
            // 400, not 401: a 401 makes the frontend treat the session as expired.
            if (!ok) throw new BadRequestError("Current password is incorrect");
        }
        if (String(body.newPassword).length < 6) throw new BadRequestError("Password must be at least 6 characters");
        user.password = body.newPassword;
    }

    await user.save();
    res.status(StatusCodes.OK).json({ user: toUserDTO(user) });
};

// =========================
// PUT /auth/me/avatar   (multipart, field "avatar")
// =========================
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const uploadAvatar = async (req, res) => {
    if (!imagekit) {
        throw new BadRequestError("Photo uploads are not configured on the server (ImageKit keys missing)");
    }
    const file = req.files?.avatar;
    if (!file || Array.isArray(file)) throw new BadRequestError("Attach one image in the 'avatar' field");
    if (!AVATAR_TYPES.includes(file.mimetype)) throw new BadRequestError("Photo must be a JPG, PNG or WebP image");
    if (file.size > MAX_AVATAR_BYTES) throw new BadRequestError("Photo must be 3 MB or smaller");

    const user = await CleanBridgeUser.findById(req.user.userId);
    const ext = file.mimetype.split("/")[1].replace("jpeg", "jpg");

    let uploaded;
    try {
        uploaded = await imagekit.upload({
            file: file.data,
            fileName: `${user._id}-${Date.now()}.${ext}`,
            folder: "/cleanbridge/avatars",
            useUniqueFileName: false,
        });
    } catch (err) {
        throw new BadRequestError(`Could not upload photo: ${err.message}`);
    }

    const oldFileId = user.avatarSource === "upload" ? user.avatarFileId : null;
    user.avatarUrl = uploaded.url;
    user.avatarFileId = uploaded.fileId;
    user.avatarSource = "upload";
    await user.save();

    if (oldFileId) imagekit.deleteFile(oldFileId).catch(() => {});

    res.status(StatusCodes.OK).json({ user: toUserDTO(user) });
};

// =========================
// DELETE /auth/me/avatar   -> falls back to the Google photo if there is one
// =========================
const removeAvatar = async (req, res) => {
    const user = await CleanBridgeUser.findById(req.user.userId);
    if (user.avatarSource === "upload" && user.avatarFileId && imagekit) {
        imagekit.deleteFile(user.avatarFileId).catch(() => {});
    }
    user.avatarFileId = null;
    user.avatarUrl = user.googleAvatarUrl || null;
    user.avatarSource = user.googleAvatarUrl ? "google" : null;
    await user.save();
    res.status(StatusCodes.OK).json({ user: toUserDTO(user) });
};

// =========================
// PUT /auth/me/live-location   (collector)   { lat, lng }
// Shared while working so customers can watch their collector approach.
// =========================
const updateLiveLocation = async (req, res) => {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!isInGhana(lat, lng)) throw new BadRequestError("Location must be in Ghana");

    await CleanBridgeUser.updateOne(
        { _id: req.user.userId },
        { lastLocation: { lat, lng, updatedAt: new Date() } }
    );
    res.status(StatusCodes.OK).json({ ok: true });
};

// =========================
// Google sign-in (called from routes/googleAuth.js's shared callback when
// the OAuth state says app === "cleanbridge")
// =========================
const googleCallback = async (req, res, state) => {
    const redirectUri = state.redirectUri;
    // Re-checked here: this token must never be sent to a host that isn't
    // on ALLOWED_REDIRECT_DOMAINS.
    if (!isAllowedCleanbridgeRedirect(redirectUri)) {
        return res.status(400).json({ msg: "redirect_uri is not an allowed CleanBridge domain." });
    }

    const { id: googleId, email, fullName, profilePic } = req.user;
    const photo = largerGooglePhoto(profilePic);

    let user = await CleanBridgeUser.findOne({ $or: [{ googleId }, { email: String(email).toLowerCase() }] });

    // Owner/admin bootstrap: emails listed in CLEANBRIDGE_ADMIN_EMAILS become
    // admins - only through Google sign-in, which proves they own the address.
    const adminEmails = (process.env.CLEANBRIDGE_ADMIN_EMAILS || "")
        .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const isOwnerAdmin = adminEmails.includes(String(email).toLowerCase());

    if (user && !user.isActive) {
        return res.redirect(appendQueryParam(redirectUri, "error", "This account has been suspended. Contact CleanBridge support."));
    }

    if (!user) {
        const role = isOwnerAdmin ? "admin" : state.role === "collector" ? "collector" : "customer";
        user = await CleanBridgeUser.create({
            name: fullName || email.split("@")[0],
            email,
            googleId,
            role,
            googleAvatarUrl: photo,
            avatarUrl: photo,
            avatarSource: photo ? "google" : null,
        });
        await welcome(user);
    } else {
        if (isOwnerAdmin && user.role !== "admin") {
            // If someone registered this email with a password before the real
            // owner signed in with Google, that password must not keep access.
            if (!user.googleId) user.password = undefined;
            user.role = "admin";
        }
        user.googleId = user.googleId || googleId;
        user.googleAvatarUrl = photo;
        // Keep the Google photo fresh unless they uploaded their own.
        if (user.avatarSource !== "upload") {
            user.avatarUrl = photo;
            user.avatarSource = photo ? "google" : null;
        }
        await user.save();
    }

    res.redirect(appendQueryParam(redirectUri, "token", user.createJWT()));
};

// =========================
// DELETE /auth/me   { confirm: "DELETE" }
// Required by Google Play and the App Store: users can delete their account
// in-app. Personal data is removed; pickup/payout records are kept (with the
// person anonymised) because they are financial records.
// =========================
const deleteAccount = async (req, res) => {
    if (req.body?.confirm !== "DELETE") throw new BadRequestError("Type DELETE to confirm");
    const Pickup = require("../models/CleanBridgePickup.js");
    const Vehicle = require("../models/CleanBridgeVehicle.js");
    const Notification = require("../models/CleanBridgeNotification.js");
    const user = await CleanBridgeUser.findById(req.user.userId);

    if (user.role === "admin") {
        throw new BadRequestError("Admin accounts can't be deleted from the app. Ask another admin to suspend it.");
    }
    const open = await Pickup.countDocuments({
        $or: [{ customerId: user._id }, { collectorId: user._id }],
        status: { $in: ["requested", "assigned", "on_the_way"] },
    });
    if (open) throw new BadRequestError("Finish or cancel your open pickups before deleting your account");

    await Promise.all([
        Pickup.updateMany({ customerId: user._id }, { customerName: "Deleted user", customerPhone: null, gateNote: null }),
        Pickup.updateMany({ collectorId: user._id }, { collectorName: "Deleted collector", collectorPhone: null }),
        Vehicle.deleteOne({ collectorId: user._id }),
        Notification.deleteMany({ userId: user._id }),
    ]);
    if (user.avatarSource === "upload" && user.avatarFileId && imagekit) {
        imagekit.deleteFile(user.avatarFileId).catch(() => {});
    }
    await CleanBridgeUser.deleteOne({ _id: user._id });

    res.status(StatusCodes.OK).json({ deleted: true });
};

module.exports = {
    signUp,
    login,
    getCurrentUser,
    updateCurrentUser,
    uploadAvatar,
    removeAvatar,
    updateLiveLocation,
    googleCallback,
    deleteAccount,
};
