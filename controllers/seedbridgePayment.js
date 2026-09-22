const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/SeedBridgeOrder.js');
const Produce = require('../models/SeedBridgeProduce.js');
const { BadRequestError } = require('../errors');
const { StatusCodes } = require('http-status-codes');
const { isAllowedRedirectUri } = require('../utils/oauthRedirect.js');

// Same dev-safety convention as controllers/paystackController.js: prefer
// the test key when it's set, so local/dev checkouts never hit a live card.
const PAYSTACK_SECRET_KEY = process.env.TEST_PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const paystack = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
});

// Paystack requires an email even for a MoMo-only checkout. Most users
// won't have one (phone-first signup), so we synthesize a stable
// placeholder - Paystack never actually emails this address.
const emailForBuyer = (buyerId) => `buyer-${buyerId}@seedbridge.app`;

// Unlike the legacy /api/v1/paystack flow (one fixed callback URL for
// everyone), this checkout accepts the caller's own callbackUrl the same
// way Google login does - validated against ALLOWED_REDIRECT_DOMAINS in
// .env - so any frontend using this endpoint lands back on itself, not a
// single hardcoded app.
//
// Mirrors routes/googleAuth.js's redirect_uri handling: a caller that
// explicitly passes a disallowed URL gets rejected with a clear error
// (not silently swapped for the default - that would hide a real
// misconfiguration on the caller's side). The fallback only kicks in when
// no callbackUrl was given at all.
const resolveCallbackUrl = (callbackUrl) => {
    const target = callbackUrl || (process.env.SEEDBRIDGE_CLIENT_URL && `${process.env.SEEDBRIDGE_CLIENT_URL}/payment/callback`);
    return target && isAllowedRedirectUri(target) ? target : null;
};

// =========================
// POST /payments/initialize
// Buyer taps "Buy" on a produce listing. Instead of creating the order
// immediately, this reserves nothing yet and just asks Paystack for a
// hosted checkout page (authorization_url) - the order itself is only
// created once payment actually succeeds, in finalizeOrder() below.
// =========================
const initializeCheckout = async (req, res) => {
    const { produceId, quantityKg, deliveryAddress, notes, isDeposit, callbackUrl } = req.body;

    if (!produceId || !quantityKg || !deliveryAddress) {
        throw new BadRequestError('Please provide produceId, quantityKg and deliveryAddress');
    }

    const resolvedCallbackUrl = resolveCallbackUrl(callbackUrl);
    if (!resolvedCallbackUrl) {
        throw new BadRequestError(
            'Missing or disallowed callbackUrl. Add its domain to ALLOWED_REDIRECT_DOMAINS in .env, or set SEEDBRIDGE_CLIENT_URL as a fallback.'
        );
    }

    const produce = await Produce.findById(produceId);
    if (!produce) {
        throw new BadRequestError(`No produce listing with id: ${produceId}`);
    }

    if (produce.availableKg < quantityKg) {
        throw new BadRequestError(`Only ${produce.availableKg}kg available for this listing`);
    }

    const buyerId = req.user.userId;
    const buyerName = req.user.name || req.user.username;
    const totalAmount = quantityKg * produce.pricePerKg;
    const depositAmount = isDeposit ? (produce.depositRequired || 0) : null;
    const amountToChargeNow = isDeposit ? depositAmount : totalAmount;

    if (!amountToChargeNow || amountToChargeNow <= 0) {
        throw new BadRequestError('Nothing to charge - check depositRequired on this listing');
    }

    const reference = `sb_${produceId}_${buyerId}_${Date.now()}`;

    // Everything needed to create the order later is stashed in Paystack's
    // own metadata field - nothing touches our DB until payment succeeds.
    const metadata = {
        buyerId,
        buyerName,
        farmerId: String(produce.farmerId),
        farmerName: produce.farmerName,
        produceId,
        crop: produce.crop,
        quantityKg,
        pricePerKg: produce.pricePerKg,
        totalAmount,
        depositPaid: isDeposit ? depositAmount : null,
        deliveryAddress,
        notes: notes || null,
        isDeposit: !!isDeposit,
    };

    let response;
    try {
        response = await paystack.post('/transaction/initialize', {
            email: emailForBuyer(buyerId),
            amount: Math.round(amountToChargeNow * 100), // pesewas
            currency: 'GHS',
            reference,
            callback_url: resolvedCallbackUrl,
            metadata,
        });
    } catch (err) {
        const message = err.response?.data?.message || err.message;
        throw new BadRequestError(`Could not start checkout: ${message}`);
    }

    const data = response.data.data;

    return res.status(StatusCodes.OK).json({
        authorizationUrl: data.authorization_url,
        reference: data.reference,
    });
};

// =========================
// GET /payments/finalize/:reference
// The frontend calls this right after Paystack redirects the buyer back
// to its own callback URL with ?reference=... - this is where the order
// actually gets created, but only once we've verified payment truly
// succeeded.
// =========================
const finalizeOrder = async (req, res) => {
    const { reference } = req.params;

    let response;
    try {
        response = await paystack.get(`/transaction/verify/${reference}`);
    } catch (err) {
        const message = err.response?.data?.message || err.message;
        throw new BadRequestError(`Verification failed: ${message}`);
    }

    const data = response.data.data;

    if (data.status !== 'success') {
        return res.status(StatusCodes.OK).json({ success: false, status: data.status });
    }

    const order = await createOrderFromPaidTransaction(data);

    return res.status(StatusCodes.OK).json({ success: true, order });
};

// Paystack returns the mobile network name in data.authorization.bank for
// MoMo transactions (e.g. "MTN", "Vodafone", "AirtelTigo") - not lowercase,
// and not matching our mtn/vod/atl enum values, so it needs mapping.
const normalizeProvider = (bankName) => {
    if (!bankName) return null;
    const normalized = bankName.toLowerCase();
    if (normalized.includes('mtn')) return 'mtn';
    if (normalized.includes('vod') || normalized.includes('telecel')) return 'vod';
    if (normalized.includes('airtel') || normalized.includes('tigo')) return 'atl';
    return null; // unrecognized - better to store null than fail the whole order
};

// Shared helper: creates the Order from a verified Paystack transaction's
// metadata, decrements the produce stock, and is safe to call twice - both
// the browser callback (finalizeOrder) and the webhook can race to call
// this for the same reference, and only the first one wins.
const createOrderFromPaidTransaction = async (transactionData) => {
    const existing = await Order.findOne({ paystackReference: transactionData.reference });
    if (existing) {
        return existing; // already created by the other path - idempotent
    }

    const m = transactionData.metadata;
    if (!m || !m.produceId) {
        // Not one of our checkout transactions (or metadata got stripped) - nothing to do.
        return null;
    }

    const produce = await Produce.findById(m.produceId);
    if (!produce) {
        return null;
    }

    const order = await Order.create({
        buyerId: m.buyerId,
        buyerName: m.buyerName,
        farmerId: m.farmerId,
        farmerName: m.farmerName,
        produceId: m.produceId,
        crop: m.crop,
        quantityKg: m.quantityKg,
        pricePerKg: m.pricePerKg,
        totalAmount: m.totalAmount,
        depositPaid: m.depositPaid,
        deliveryAddress: m.deliveryAddress,
        notes: m.notes,
        status: 'confirmed',
        paymentStatus: m.isDeposit ? 'deposit_held' : 'escrow_held',
        paystackReference: transactionData.reference,
        paymentProvider: normalizeProvider(transactionData.authorization?.bank),
        paymentGatewayResponse: transactionData.gateway_response || 'success',
    });

    produce.availableKg -= m.quantityKg;
    if (produce.availableKg <= 0) {
        produce.status = 'sold_out';
    } else if (produce.availableKg < produce.quantityKg) {
        produce.status = 'partially_sold';
    }
    await produce.save();

    return order;
};

// =========================
// POST /payments/webhook
// Paystack's authoritative, async notification - must read the RAW body
// (see app.js) so the signature can be verified before trusting the
// payload. This exists as a safety net: if the buyer closes the tab right
// after paying (before the browser redirect completes), the order still
// gets created here instead of being lost.
// =========================
const paystackWebhook = async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.body; // Buffer, thanks to express.raw() in app.js

    const expectedSignature = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(rawBody)
        .digest('hex');

    if (signature !== expectedSignature) {
        // Do not process - this request did not actually come from Paystack.
        return res.sendStatus(StatusCodes.UNAUTHORIZED);
    }

    const event = JSON.parse(rawBody.toString('utf8'));

    if (event.event === 'charge.success') {
        await createOrderFromPaidTransaction(event.data);
    }

    // Paystack just needs a 200 to know we received it - respond
    // immediately, don't make it wait on anything slow.
    return res.sendStatus(StatusCodes.OK);
};

module.exports = {
    initializeCheckout,
    finalizeOrder,
    paystackWebhook,
};
