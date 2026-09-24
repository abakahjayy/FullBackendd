const Payout = require("../models/CleanBridgePayout.js");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const Settings = require("../models/CleanBridgeSettings.js");
const { notify } = require("../utils/cleanbridgeNotify.js");
const { BadRequestError, NotFoundError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { collectorBalance, toPayoutDTO, round2 } = require("../utils/cleanbridge.js");

// =========================
// GET /payouts/balance   (collector)
// =========================
const getBalance = async (req, res) => {
    const [balance, settings] = await Promise.all([collectorBalance(req.user.userId), Settings.getGlobal()]);
    return res.status(StatusCodes.OK).json({
        ...balance,
        collectorSharePct: settings.payouts.collectorSharePct,
        minimumPayout: settings.payouts.minimumPayout,
    });
};

// =========================
// GET /payouts   collector -> own, admin -> all   ?status=
// =========================
const listPayouts = async (req, res) => {
    const filter = {};
    if (req.user.role !== "admin") filter.collectorId = req.user.userId;
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    const payouts = await Payout.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.status(StatusCodes.OK).json({ payouts: payouts.map(toPayoutDTO) });
};

// =========================
// POST /payouts   (collector)   { amount }
// Paid to the MoMo number on their profile.
// =========================
const requestPayout = async (req, res) => {
    const amount = round2(Number(req.body.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError("Enter a valid amount");

    const [collector, settings, balance] = await Promise.all([
        CleanBridgeUser.findById(req.user.userId),
        Settings.getGlobal(),
        collectorBalance(req.user.userId),
    ]);

    if (!collector.momoNumber || !collector.momoNetwork) {
        throw new BadRequestError("Add your Mobile Money number on your profile first");
    }
    if (amount < settings.payouts.minimumPayout) {
        throw new BadRequestError(`The minimum payout is GH₵ ${settings.payouts.minimumPayout.toFixed(2)}`);
    }
    if (amount > balance.available) {
        throw new BadRequestError(`You can withdraw up to GH₵ ${Math.max(0, balance.available).toFixed(2)}`);
    }

    let payout;
    try {
        payout = await Payout.create({
            collectorId: collector._id,
            collectorName: collector.name,
            amount,
            momoNumber: collector.momoNumber,
            momoNetwork: collector.momoNetwork,
        });
    } catch (err) {
        if (err.code === 11000) throw new BadRequestError("You already have a payout request waiting to be processed");
        throw err;
    }

    return res.status(StatusCodes.CREATED).json({ payout: toPayoutDTO(payout) });
};

// =========================
// DELETE /payouts/:id   (collector cancels their own open request)
// =========================
const cancelPayout = async (req, res) => {
    const payout = await Payout.findOneAndDelete({ _id: req.params.id, collectorId: req.user.userId, status: "requested" });
    if (!payout) throw new NotFoundError("No open payout request with that id");
    return res.status(StatusCodes.OK).json({ ok: true });
};

// =========================
// PATCH /payouts/:id   (admin)
// { status: "paid", reference }  - after sending the MoMo transfer
// { status: "rejected", note }
// =========================
const processPayout = async (req, res) => {
    const { status, reference, note } = req.body;
    if (!["paid", "rejected"].includes(status)) throw new BadRequestError("status must be paid or rejected");
    if (status === "paid" && !String(reference || "").trim()) {
        throw new BadRequestError("Enter the Mobile Money transaction ID");
    }
    if (status === "rejected" && !String(note || "").trim()) {
        throw new BadRequestError("Give the collector a reason for rejecting");
    }

    const payout = await Payout.findOneAndUpdate(
        { _id: req.params.id, status: "requested" },
        {
            status,
            reference: status === "paid" ? String(reference).trim() : null,
            note: note ? String(note).trim() : null,
            processedBy: req.user.userId,
            processedAt: new Date(),
        },
        { new: true }
    );
    if (!payout) throw new BadRequestError("This payout was already processed");

    await notify(payout.collectorId,
        status === "paid" ? "Payout sent" : "Payout request declined",
        status === "paid"
            ? `GH₵ ${payout.amount.toFixed(2)} was sent to your ${payout.momoNetwork} MoMo ${payout.momoNumber} (ref ${payout.reference}).`
            : `Your GH₵ ${payout.amount.toFixed(2)} payout was declined: ${payout.note}`,
        { ctaPath: "/collector/earnings", ctaLabel: "View earnings" });

    return res.status(StatusCodes.OK).json({ payout: toPayoutDTO(payout) });
};

module.exports = { getBalance, listPayouts, requestPayout, cancelPayout, processPayout };
