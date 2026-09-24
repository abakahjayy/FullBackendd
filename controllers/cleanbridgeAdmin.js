const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const Pickup = require("../models/CleanBridgePickup.js");
const Vehicle = require("../models/CleanBridgeVehicle.js");
const Notification = require("../models/CleanBridgeNotification.js");
const { notify } = require("../utils/cleanbridgeNotify.js");
const { sendCleanbridgeEmail, clientUrl } = require("../utils/cleanbridgeMail.js");
const { BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { toUserDTO, toVehicleDTO, toPickupDTO, collectorBalance, round2 } = require("../utils/cleanbridge.js");
const { normalizeGhanaPhone, detectNetwork, SERVICE_HUBS } = require("../utils/ghana.js");

const searchFilter = (role, q) => {
    const filter = { role };
    if (q) {
        const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { area: rx }];
    }
    return filter;
};

// =========================
// GET /admin/customers   ?q=
// =========================
const listCustomers = async (req, res) => {
    const customers = await CleanBridgeUser.find(searchFilter("customer", req.query.q)).sort({ createdAt: -1 }).limit(200);

    const stats = await Pickup.aggregate([
        { $match: { customerId: { $in: customers.map((c) => c._id) } } },
        {
            $group: {
                _id: "$customerId",
                pickups: { $sum: 1 },
                lastPickup: { $max: "$scheduledDate" },
                spent: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$estimatedPrice", 0] } },
            },
        },
    ]);
    const byId = Object.fromEntries(stats.map((s) => [String(s._id), s]));

    return res.status(StatusCodes.OK).json({
        customers: customers.map((c) => ({
            ...toUserDTO(c),
            pickups: byId[c._id]?.pickups || 0,
            lastPickup: byId[c._id]?.lastPickup || null,
            totalSpent: round2(byId[c._id]?.spent || 0),
        })),
    });
};

// =========================
// GET /admin/collectors   ?q=&status=available|on_route|off_duty
// =========================
const listCollectors = async (req, res) => {
    const filter = searchFilter("collector", req.query.q);
    if (req.query.status) filter.collectorStatus = req.query.status;
    const collectors = await CleanBridgeUser.find(filter).sort({ name: 1 }).limit(200);
    const ids = collectors.map((c) => c._id);

    const [vehicles, balances] = await Promise.all([
        Vehicle.find({ collectorId: { $in: ids } }),
        Promise.all(collectors.map((c) => collectorBalance(c._id))),
    ]);
    const vehicleById = Object.fromEntries(vehicles.map((v) => [String(v.collectorId), v]));

    return res.status(StatusCodes.OK).json({
        collectors: collectors.map((c, i) => ({
            ...toUserDTO(c),
            completedJobs: balances[i].completedJobs,
            totalEarnings: balances[i].earned,
            balance: balances[i].available,
            vehicle: vehicleById[c._id] ? toVehicleDTO(vehicleById[c._id]) : null,
        })),
    });
};

// =========================
// POST /admin/users   (create a collector or another admin)
// { name, email, phone, password, role: "collector" | "admin", area? }
// =========================
const createUser = async (req, res) => {
    const { name, email, phone, password, role, area } = req.body;
    if (!["collector", "admin"].includes(role)) throw new BadRequestError("role must be collector or admin");
    if (!name || !email || !phone || !password) {
        throw new BadRequestError("Please provide name, email, phone and a temporary password");
    }
    if (!normalizeGhanaPhone(phone)) throw new BadRequestError("Enter a valid Ghana mobile number");

    const user = await CleanBridgeUser.create({
        name, email, phone, password, role, area,
        ...(role === "collector" ? { momoNumber: phone, momoNetwork: detectNetwork(phone) } : {}),
    });
    await notify(user._id, "Welcome to CleanBridge GH",
        role === "collector"
            ? "Register your vehicle on the Vehicle page so operations can verify it and you can start taking jobs."
            : "You have operations access. Change your temporary password on your profile.",
        { ctaPath: role === "collector" ? "/collector/vehicle" : "/profile", ctaLabel: "Get started" });
    return res.status(StatusCodes.CREATED).json({ user: toUserDTO(user) });
};

// =========================
// PATCH /admin/users/:id/active   { isActive }   (suspend / reinstate)
// =========================
const setUserActive = async (req, res) => {
    if (typeof req.body.isActive !== "boolean") {
        throw new BadRequestError("isActive must be true or false");
    }
    if (String(req.params.id) === String(req.user.userId)) {
        throw new BadRequestError("You cannot change your own account status");
    }
    const user = await CleanBridgeUser.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    if (!user) throw new NotFoundError(`No user with id: ${req.params.id}`);
    return res.status(StatusCodes.OK).json({ user: toUserDTO(user) });
};

// =========================
// POST /admin/broadcast   { audience: all|customers|collectors, title, message, email? }
// email: true also emails everyone who hasn't opted out (sent in the background,
// rate-limited; mind Gmail's ~500/day sending limit).
// =========================
const broadcast = async (req, res) => {
    const { audience = "all", title, message } = req.body;
    if (!title?.trim() || !message?.trim()) throw new BadRequestError("Please provide a title and message");
    if (title.length > 80 || message.length > 500) throw new BadRequestError("Keep the title under 80 and the message under 500 characters");

    const roleFilter = { all: { $in: ["customer", "collector"] }, customers: "customer", collectors: "collector" }[audience];
    if (!roleFilter) throw new BadRequestError("audience must be all, customers or collectors");

    const users = await CleanBridgeUser.find({ role: roleFilter, isActive: true }).select("_id name email emailNotifications");
    if (users.length) {
        await Notification.insertMany(users.map((u) => ({ userId: u._id, title: title.trim(), message: message.trim() })));
    }

    let emailed = 0;
    if (req.body.email === true) {
        const recipients = users.filter((u) => u.email && u.emailNotifications !== false);
        emailed = recipients.length;
        setImmediate(async () => {
            for (const u of recipients) {
                // Sequential on purpose: the pooled transport rate-limits sends.
                await sendCleanbridgeEmail(u, { title: title.trim(), message: message.trim(), cta: { label: "Open CleanBridge", url: clientUrl("/notifications") } });
            }
        });
    }
    return res.status(StatusCodes.OK).json({ sent: users.length, emailed });
};

// =========================
// GET /admin/live   (network map: open pickups, collectors' live positions, hubs)
// =========================
const liveMap = async (req, res) => {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const [pickups, collectors] = await Promise.all([
        Pickup.find({ status: { $in: ["requested", "assigned", "on_the_way"] } }).sort({ scheduledDate: 1 }).limit(500),
        CleanBridgeUser.find({ role: "collector", isActive: true, "lastLocation.updatedAt": { $gte: since } }),
    ]);
    return res.status(StatusCodes.OK).json({
        hubs: SERVICE_HUBS,
        pickups: pickups.map(toPickupDTO),
        collectors: collectors.map((c) => ({
            id: c._id.toString(),
            name: c.name,
            phone: c.phone,
            collectorStatus: c.collectorStatus,
            location: { lat: c.lastLocation.lat, lng: c.lastLocation.lng },
            updatedAt: c.lastLocation.updatedAt,
        })),
    });
};

module.exports = { listCustomers, listCollectors, createUser, setUserActive, broadcast, liveMap };
