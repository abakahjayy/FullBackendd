const axios = require("axios");
const Pickup = require("../models/CleanBridgePickup.js");
const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { notify } = require("../utils/cleanbridgeNotify.js");
const { BadRequestError, NotFoundError, UnauthorizedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { isAllowedCleanbridgeRedirect } = require("../utils/oauthRedirect.js");
const { toPickupDTO } = require("../utils/cleanbridge.js");

// Customer pays for a pickup with Mobile Money (or card) through Paystack's
// hosted checkout. Same conventions as controllers/seedbridgePayment.js:
// prefer the test key when set, caller-supplied callbackUrl validated
// against ALLOWED_REDIRECT_DOMAINS, and the payment is only trusted after a
// server-side verify call.
const PAYSTACK_SECRET_KEY = process.env.TEST_PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
const paystack = axios.create({
    baseURL: "https://api.paystack.co",
    timeout: 15000,
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
});

const pesewas = (cedis) => Math.round(cedis * 100);

const PAYSTACK_CHANNELS = ["mobile_money", "card", "bank", "bank_transfer", "ussd", "qr", "apple_pay"];

// e.g. "MTN MoMo", "Visa card", "Bank transfer" - shown on the receipt.
const describeChannel = (data) => {
    const auth = data.authorization || {};
    switch (data.channel) {
        case "mobile_money": return `${auth.bank || "Mobile"} MoMo`.replace(/^Vodafone/i, "Telecel");
        case "card": return `${(auth.card_type || "Card").trim()} card${auth.last4 ? ` •••• ${auth.last4}` : ""}`;
        case "bank": return `${auth.bank || "Bank"} account`;
        case "bank_transfer": return "Bank transfer";
        case "ussd": return "USSD";
        case "qr": return "QR code";
        case "apple_pay": return "Apple Pay";
        default: return data.channel || "Online";
    }
};

// =========================
// POST /payments/pickups/:id/initialize   (customer)   { callbackUrl }
// =========================
const initializePickupPayment = async (req, res) => {
    const { callbackUrl } = req.body;
    if (!isAllowedCleanbridgeRedirect(callbackUrl)) {
        throw new BadRequestError("Missing or disallowed callbackUrl. Add its domain to ALLOWED_REDIRECT_DOMAINS in .env.");
    }
    if (!PAYSTACK_SECRET_KEY) {
        throw new BadRequestError("Online payments are not configured on the server");
    }

    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) throw new NotFoundError(`No pickup with id: ${req.params.id}`);
    if (String(pickup.customerId) !== String(req.user.userId)) {
        throw new UnauthorizedError("You can only pay for your own pickups");
    }
    if (pickup.status === "cancelled") throw new BadRequestError("This pickup was cancelled");
    if (pickup.paymentStatus !== "unpaid") throw new BadRequestError("This pickup is already paid");

    const customer = await CleanBridgeUser.findById(req.user.userId);
    const reference = `cb_${pickup._id}_${Date.now()}`;

    let response;
    try {
        response = await paystack.post("/transaction/initialize", {
            email: customer.email || `customer-${customer._id}@cleanbridge.app`,
            amount: pesewas(pickup.estimatedPrice),
            currency: "GHS",
            reference,
            callback_url: callbackUrl,
            // Every channel Paystack offers in Ghana; checkout only shows the
            // ones enabled on the Paystack account (Settings > Preferences).
            channels: PAYSTACK_CHANNELS,
            metadata: {
                app: "cleanbridge",
                pickupId: String(pickup._id),
                pickupCode: pickup.code,
                custom_fields: [{ display_name: "Pickup", variable_name: "pickup", value: pickup.code }],
            },
        });
    } catch (err) {
        const message = err.response?.data?.message || err.message;
        throw new BadRequestError(`Could not start payment: ${message}`);
    }

    pickup.paymentMethod = "momo";
    pickup.paystackReference = reference;
    await pickup.save();

    return res.status(StatusCodes.OK).json({
        authorizationUrl: response.data.data.authorization_url,
        reference,
    });
};

// =========================
// GET /payments/verify/:reference   (customer, after Paystack redirects back)
// Idempotent: safe to call more than once for the same reference.
// =========================
const verifyPickupPayment = async (req, res) => {
    const { reference } = req.params;
    const pickup = await Pickup.findOne({ paystackReference: reference });
    if (!pickup) throw new NotFoundError("No pickup matches this payment reference");
    if (String(pickup.customerId) !== String(req.user.userId) && req.user.role !== "admin") {
        throw new UnauthorizedError("This payment belongs to another account");
    }
    if (pickup.paymentStatus === "paid") {
        return res.status(StatusCodes.OK).json({ success: true, pickup: toPickupDTO(pickup) });
    }

    let data;
    try {
        ({ data: { data } } = await paystack.get(`/transaction/verify/${encodeURIComponent(reference)}`));
    } catch (err) {
        const message = err.response?.data?.message || err.message;
        throw new BadRequestError(`Could not verify payment: ${message}`);
    }

    // Never trust the redirect alone - the charged amount, currency and
    // pickup must all match what we expect.
    const valid = data.status === "success"
        && data.currency === "GHS"
        && data.amount === pesewas(pickup.estimatedPrice)
        && data.metadata?.pickupId === String(pickup._id);

    if (!valid) {
        return res.status(StatusCodes.OK).json({ success: false, status: data.status, pickup: toPickupDTO(pickup) });
    }

    const updated = await Pickup.findOneAndUpdate(
        { _id: pickup._id, paymentStatus: "unpaid" },
        {
            paymentStatus: "paid",
            paidAt: new Date(data.paid_at || Date.now()),
            paymentChannel: data.channel || null,
            paymentChannelLabel: describeChannel(data),
        },
        { new: true }
    );
    if (updated) {
        await notify(pickup.customerId, "Payment received",
            `We received GH₵ ${pickup.estimatedPrice.toFixed(2)} for pickup ${pickup.code} via ${updated.paymentChannelLabel}. Thank you!`,
            { pickupId: pickup._id, ctaLabel: "View receipt" });
    }

    return res.status(StatusCodes.OK).json({ success: true, pickup: toPickupDTO(updated || await Pickup.findById(pickup._id)) });
};

module.exports = { initializePickupPayment, verifyPickupPayment };
