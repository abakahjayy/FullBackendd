// Hand-written labels, descriptions and examples for /api-docs.
//
// Key: "METHOD /full/express/path" exactly as mounted (with :params).
// Fields (all optional): summary, description, body, query, params, response,
// status, responseLabel, upload, fileField, tag.
// Anything not listed here is still documented - utils/apiDocs.js infers a
// label and example fields from the route and its controller.
//
// Real CleanBridge request/response pairs are recorded into apiExamples.json by
// scripts/captureApiExamples.js and merged in below (hand-written text wins).

const CB = "/api/v1/cleanbridge";
const SB = "/api/v1/seedbridge";

const ID = "66f2a1c9e4b0a1b2c3d4e5f6";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

const notes = {
    // ======================= Shared users (OpenLabs etc.) =======================
    "POST /api/v1/auth/signup": {
        summary: "Create an account (shared users)",
        description: "Creates a user in the shared `users` collection, sets the `token` cookie and emails a verification link.",
        body: { firstName: "Kofi", lastName: "Mensah", username: "kofimensah", email: "kofi.mensah@example.com", password: "Secret123!", phone: "0241234567" },
        status: 201,
        response: { message: "User registered successfully!", token: TOKEN, userId: ID },
    },
    "POST /api/v1/auth/login": {
        summary: "Log in (shared users)",
        description: "Also sets the `token` cookie.",
        body: { email: "kofi.mensah@example.com", password: "Secret123!" },
        response: { message: "Login successful!", token: TOKEN, userId: ID },
    },
    "POST /api/v1/auth/logout": { summary: "Log out (clears the session cookies)", response: { message: "Successfully logged out: Kofi" } },
    "GET /api/v1/auth/verify-email": { summary: "Verify email from the link in the signup email", query: { token: "a1b2c3...", email: "kofi.mensah@example.com" } },
    "PATCH /api/v1/auth/:userId": {
        summary: "Change password (shared users)",
        body: { oldPassword: "Secret123!", newPassword: "EvenBetter456!" },
        response: { message: "Password changed successfully", user: { _id: ID, firstName: "Kofi", lastName: "Mensah", username: "kofimensah", email: "kofi.mensah@example.com" } },
    },
    "GET /api/v1/auth/google": {
        summary: "Start Google sign-in (any app)",
        description: "Open this in the browser. `app` picks whose users to sign in (`cleanbridge`, or leave it out for shared users). `redirect_uri` must be on ALLOWED_REDIRECT_DOMAINS and receives `?token=` afterwards.",
        query: { app: "cleanbridge", role: "customer", redirect_uri: "https://cleanbridge-gh.onrender.com/auth/callback" },
        response: "302 redirect to accounts.google.com",
    },
    "GET /api/v1/auth/google/callback": { summary: "Google sign-in callback (called by Google)", description: "Not called directly. Redirects to the app's `redirect_uri` with `?token=` or `?error=`.", response: "302 redirect to redirect_uri?token=..." },

    // ======================= Password reset (every app) =======================
    ...Object.fromEntries(["/api/v1/auth", `${SB}/auth`, `${CB}/auth`].flatMap((base) => [
        [`POST ${base}/forgot-password`, {
            summary: "Forgot password - email a reset link",
            description: "Always answers the same way, whether or not the email has an account. With `redirect_uri` (must be an allowed domain) the link opens your app's own reset page with `?token=&email=`; without it, this backend's hosted page `/resetPassword`. Links last 30 minutes and work once. Rate limited to 5 per 15 minutes.",
            body: { email: "kofi.mensah@example.com", redirect_uri: "https://your-app.example.com/reset-password" },
            query: {},
            response: { message: "If an account exists for that email, a password reset link has been sent." },
        }],
        [`POST ${base}/reset-password/:token`, {
            summary: "Reset password with the emailed token",
            description: "`token` and `email` come from the emailed link. 400 if the link is wrong, used or expired.",
            params: { token: "4f9c2a7d1e..." },
            query: { email: "kofi.mensah@example.com" },
            body: { newPassword: "EvenBetter456!" },
            response: { message: "Your password has been reset. You can now log in." },
        }],
        [`POST ${base}/reset-password`, {
            summary: "Reset password (token in the body)",
            description: "Same as `/reset-password/:token`, for clients that prefer sending everything in the body.",
            query: {},
            body: { token: "4f9c2a7d1e...", email: "kofi.mensah@example.com", newPassword: "EvenBetter456!" },
            response: { message: "Your password has been reset. You can now log in." },
        }],
    ])),

    // ======================= Portfolio =======================
    "POST /api/contact": {
        summary: "Portfolio contact form",
        description: "Saves the message and emails the site owner. Required: fullName, email, subject, message.",
        body: { fullName: "Ama Owusu", email: "ama@example.com", phone: "0201234567", subject: "Website for my shop", projectType: "Website", budget: "GH₵ 3,000 - 5,000", timeline: "1 month", message: "Hi, I'd like a website for my shop in Kumasi." },
        status: 201,
        response: { success: true, submission: { _id: ID, fullName: "Ama Owusu", email: "ama@example.com", subject: "Website for my shop", createdAt: "2026-09-24T10:00:00.000Z" } },
    },
    "POST /api/order": {
        summary: "Portfolio project order form",
        body: { businessName: "Ama's Kitchen", name: "Ama Owusu", email: "ama@example.com", phone: "0201234567", projectType: "E-commerce", websitePages: "Home, Menu, Order, Contact", featuresNeeded: ["Online payment", "WhatsApp chat"], budget: "GH₵ 5,000", deadline: "2026-11-30", referenceWebsite: "https://example.com", projectDescription: "Online ordering for my restaurant.", preferredContactMethod: "WhatsApp", agreeToBeContacted: true },
        status: 201,
        response: { success: true, submission: { _id: ID, businessName: "Ama's Kitchen", name: "Ama Owusu", email: "ama@example.com", createdAt: "2026-09-24T10:00:00.000Z" } },
    },

    // ======================= SeedBridge =======================
    [`POST ${SB}/auth/signup`]: {
        summary: "Create a SeedBridge account",
        body: { name: "Abena Farms", phone: "0241234567", password: "Secret123!", role: "farmer", email: "abena@example.com", region: "Ashanti" },
        status: 201,
        response: { message: "Account created successfully!", token: TOKEN, user: { id: ID, name: "Abena Farms", phone: "+233241234567", role: "farmer", region: "Ashanti" } },
    },
    [`POST ${SB}/auth/login`]: {
        summary: "Log in to SeedBridge (with phone)",
        body: { phone: "0241234567", password: "Secret123!" },
        response: { message: "Login successful!", token: TOKEN, user: { id: ID, name: "Abena Farms", phone: "+233241234567", role: "farmer" } },
    },
    [`GET ${SB}/auth/me`]: { summary: "Current SeedBridge user", response: { user: { id: ID, name: "Abena Farms", phone: "+233241234567", role: "farmer", region: "Ashanti" } } },
    [`POST ${SB}/payments/webhook`]: { summary: "Paystack webhook (called by Paystack)", description: "Raw JSON body, verified with the `x-paystack-signature` HMAC. Not for manual use.", body: { event: "charge.success", data: { reference: "SB-1a2b3c", status: "success" } } },
    [`POST ${SB}/ussd`]: { summary: "USSD session handler (called by the USSD gateway)", description: "Reply starts with `CON ` (session continues) or `END ` (session ends).", body: { phoneNumber: "+233241234567", text: "1*2" }, response: "CON Choose crop:\n1. Maize\n2. Tomato" },

    // ======================= CleanBridge GH =======================
    [`POST ${CB}/auth/signup`]: { summary: "Sign up (customer or collector)", description: "`role` is `customer` (default) or `collector`. Admin sign-up needs `adminKey` = CLEANBRIDGE_ADMIN_SIGNUP_KEY. Phone must be a Ghana mobile number. Returns a token." },
    [`POST ${CB}/auth/login`]: { summary: "Log in with email or phone", description: "`identifier` is the email or a Ghana phone number. Google-only accounts get a 401 telling them to continue with Google." },
    [`GET ${CB}/auth/me`]: { summary: "Current user", description: "`profileComplete` is false until the user has a phone number (fresh Google sign-ups)." },
    [`PATCH ${CB}/auth/me`]: { summary: "Update my profile or password", description: "Send only what changes. Collectors can also send `collectorStatus` (available | on_route | off_duty) and `momoNumber`. To change the password send `currentPassword` + `newPassword` (Google-only accounts can set a first password without `currentPassword`)." },
    [`DELETE ${CB}/auth/me`]: { summary: "Delete my account", description: "Personal data is removed; pickup and payout records stay, anonymised. Admins can't delete themselves.", body: { confirm: "DELETE" } },
    [`PUT ${CB}/auth/me/avatar`]: { summary: "Upload a profile photo", upload: true, fileField: "avatar", body: {}, description: "multipart/form-data with the image in `avatar` (JPG, PNG or WebP).", response: { user: { id: ID, name: "Kofi Mensah", avatarUrl: "https://ik.imagekit.io/.../avatar.jpg", avatarSource: "upload" } } },
    [`DELETE ${CB}/auth/me/avatar`]: { summary: "Remove my profile photo", description: "Falls back to the Google photo if the account is linked to Google.", response: { user: { id: ID, name: "Kofi Mensah", avatarUrl: null, avatarSource: null } } },
    [`PUT ${CB}/auth/me/live-location`]: { summary: "Share my live location (collectors)", description: "The app sends this every 30 s while the collector isn't off duty; customers see it on their pickup." },

    [`POST ${CB}/pickups/quote`]: { summary: "Price quote", description: "Priced on the server from the pickup location (road distance to the nearest hub), waste type, bags, vehicle, urgency and date, plus Ghana taxes (VAT, NHIL, GETFund). Clients never send a price." },
    [`GET ${CB}/pickups/vehicle-options`]: { summary: "Vehicles for this job", description: "Each vehicle type with its fee, capacity, whether it fits the bags and how many are ready nearby. `recommended` is the smallest that fits." },
    [`GET ${CB}/pickups`]: { summary: "List pickups", description: "Customers see their own, collectors their jobs, admins everything. Filters: `status`, `area`, `from`/`to` (dates), `q` (code or address), `page`, `limit`." },
    [`POST ${CB}/pickups`]: { summary: "Book a pickup (customer)", description: "The price is computed on the server and returned with the pickup. Matching collectors who are ready get an instant alert. `paymentMethod` is `cash` or `momo` (then pay with POST /payments/pickups/:id/initialize)." },
    [`GET ${CB}/pickups/available`]: { summary: "Open jobs for collectors", description: "Unassigned pickups that match the collector's verified vehicle, nearest first." },
    [`GET ${CB}/pickups/:id`]: { summary: "Pickup details", description: "Includes the collector's live location while they're on the way." },
    [`PATCH ${CB}/pickups/:id/accept`]: { summary: "Accept a job (collector)", description: "Needs a verified vehicle of the right type. The first collector to accept gets the job." },
    [`PATCH ${CB}/pickups/:id/assign`]: { summary: "Assign to a collector (admin)", body: { collectorId: ID } },
    [`PATCH ${CB}/pickups/:id/status`]: { summary: "Move a pickup along", description: "Flow: requested → assigned → on_the_way → completed (or cancelled). Collectors move their own jobs; customers can cancel while requested or assigned. `etaMinutes` is optional with on_the_way. Completing a cash job records the cash as collected." },
    [`POST ${CB}/pickups/:id/rate`]: { summary: "Rate the collector (1-5)" },
    [`PATCH ${CB}/pickups/:id/refund`]: { summary: "Mark a MoMo payment as refunded (admin)", response: { pickup: { id: ID, code: "CB-1001", paymentMethod: "momo", paymentStatus: "refunded" } } },

    [`POST ${CB}/payments/pickups/:id/initialize`]: {
        summary: "Pay for a pickup (Paystack)",
        description: "Returns a Paystack checkout link (MoMo, card or bank transfer). Paystack sends the customer back to `callbackUrl?reference=`; then call /payments/verify/:reference.",
        body: { callbackUrl: "https://cleanbridge-gh.onrender.com/payment/callback" },
        response: { authorizationUrl: "https://checkout.paystack.com/0peioxfhpn", reference: "CB-1001-mfx2k1" },
    },
    [`GET ${CB}/payments/verify/:reference`]: {
        summary: "Confirm a payment",
        description: "Checks with Paystack on the server, marks the pickup paid and emails a receipt. Safe to call more than once.",
        params: { reference: "CB-1001-mfx2k1" },
        response: { success: true, pickup: { id: ID, code: "CB-1001", paymentMethod: "momo", paymentStatus: "paid", estimatedPrice: 44.81 } },
    },

    [`GET ${CB}/payouts/balance`]: { summary: "My earnings balance (collector)", description: "available = earned − cash already collected from customers − paid out − pending requests." },
    [`GET ${CB}/payouts`]: { summary: "Payout requests", description: "Collectors see their own; admins see all. Filter with `status` (requested | paid | rejected).", response: { payouts: [{ id: ID, collectorId: ID, collectorName: "Kwame Asante", amount: 120, momoNumber: "+233551234567", momoNetwork: "MTN", status: "requested", reference: null, note: null, processedAt: null, createdAt: "2026-09-24T10:12:00.000Z" }] } },
    [`POST ${CB}/payouts`]: { summary: "Request a payout to MoMo (collector)", description: "At least the minimum payout and no more than the available balance.", body: { amount: 120 }, status: 201, response: { payout: { id: ID, collectorId: ID, collectorName: "Kwame Asante", amount: 120, momoNumber: "+233551234567", momoNetwork: "MTN", status: "requested", reference: null, note: null, processedAt: null, createdAt: "2026-09-24T10:12:00.000Z" } } },
    [`DELETE ${CB}/payouts/:id`]: { summary: "Cancel my pending payout (collector)", response: { ok: true } },
    [`PATCH ${CB}/payouts/:id`]: { summary: "Mark a payout paid or rejected (admin)", description: "Send the MoMo yourself first, then record its transaction reference here.", body: { status: "paid", reference: "MTN-TX-889201", note: "Sent via MTN MoMo" }, response: { payout: { id: ID, collectorName: "Kwame Asante", amount: 120, momoNetwork: "MTN", status: "paid", reference: "MTN-TX-889201", note: "Sent via MTN MoMo", processedAt: "2026-09-24T11:00:00.000Z" } } },

    [`GET ${CB}/routes`]: { summary: "Collection routes", description: "Collectors see their own; admins see all. Filters: `status`, `date`." },
    [`POST ${CB}/routes`]: { summary: "Plan a route", description: "Fuel cost is estimated from the vehicle's fuel economy and today's fuel price. Admins can plan for any collector with `collectorId`." },
    [`GET ${CB}/routes/today`]: { summary: "Today's route (collector)" },
    [`GET ${CB}/routes/:id`]: { summary: "Route details with stops" },
    [`PATCH ${CB}/routes/:id/status`]: { summary: "Update route status", description: "planned | in_progress | completed | cancelled" },

    [`GET ${CB}/vehicles/me`]: { summary: "My vehicle (collector)" },
    [`PUT ${CB}/vehicles/me`]: { summary: "Add or update my vehicle (collector)", description: "Any change sends it back for verification. `registration` must be a DVLA plate like GR 1234-24." },
    [`GET ${CB}/vehicles`]: { summary: "All vehicles (admin)", description: "Filter with `verificationStatus` (pending | verified | rejected)." },
    [`PATCH ${CB}/vehicles/:id/verification`]: { summary: "Verify or reject a vehicle (admin)" },

    [`GET ${CB}/notifications`]: { summary: "My notifications", description: "`unread=true` for unread only. Also returns `unreadCount`." },
    [`PATCH ${CB}/notifications/read-all`]: { summary: "Mark all as read" },
    [`PATCH ${CB}/notifications/:id/read`]: { summary: "Mark one as read" },

    [`GET ${CB}/settings`]: { summary: "Prices, vehicle fees, taxes, payout rules and fuel price (public)" },
    [`PUT ${CB}/settings/pricing`]: { summary: "Update prices and taxes (admin)", body: { baseFee: 15, distanceFeePerKm: 1.5, perBagFee: 5, urgencyFee: 12, weekendFee: 5, minimumFee: 25, wasteTypeFees: { "Bulky items": 15 }, vehicleFees: { "Mini truck": 10 }, tax: { enabled: true, vatPct: 15, nhilPct: 2.5, getFundPct: 2.5, covidLevyPct: 0 } } },
    [`PUT ${CB}/settings/payouts`]: { summary: "Update the collector share and minimum payout (admin)" },
    [`PUT ${CB}/settings/fuel`]: { summary: "Update the fuel price (admin)", body: { fuelType: "Diesel", currentPrice: 14.86, effectiveDate: "2026-09-16" } },

    [`GET ${CB}/dashboard/customer`]: { summary: "Customer home screen data" },
    [`GET ${CB}/dashboard/collector`]: { summary: "Collector home screen data" },
    [`GET ${CB}/dashboard/admin`]: { summary: "Operations overview (admin)" },
    [`GET ${CB}/dashboard/analytics`]: { summary: "Revenue, taxes and jobs over time (admin)", description: "`days` is 7, 30 or 90." },

    [`GET ${CB}/admin/customers`]: { summary: "Customers (admin)", description: "`q` searches name, email and phone." },
    [`GET ${CB}/admin/collectors`]: { summary: "Collectors with vehicle and earnings (admin)", description: "`q` searches; `status` is available | on_route | off_duty." },
    [`POST ${CB}/admin/users`]: { summary: "Create a customer or collector (admin)" },
    [`PATCH ${CB}/admin/users/:id/active`]: { summary: "Suspend or re-activate a user (admin)" },
    [`POST ${CB}/admin/broadcast`]: {
        summary: "Send an announcement (admin)",
        description: "In-app notification to `all`, `customers` or `collectors`. `email: true` also emails everyone who hasn't opted out.",
        body: { audience: "collectors", title: "Fuel price update", message: "Diesel is now GH₵ 14.20/L from Monday.", email: false },
        response: { sent: 42, emailed: 0 },
    },
    [`GET ${CB}/admin/live`]: { summary: "Live map: hubs, collectors and open pickups (admin)" },

    [`GET ${CB}/geo/search`]: { summary: "Place search (Ghana)", description: "Search-as-you-type suggestions, biased towards `lat`/`lng`." },
    [`GET ${CB}/geo/reverse`]: { summary: "Address for a map point" },
    [`GET ${CB}/geo/hubs`]: { summary: "Service hubs" },

    [`GET ${CB}/email/unsubscribe`]: { summary: "Unsubscribe page (link in emails)", query: { token: "eyJhbGciOi..." }, response: "<html>You're unsubscribed…</html>" },
    [`POST ${CB}/email/unsubscribe`]: { summary: "One-click unsubscribe (RFC 8058, used by Gmail)", query: { token: "eyJhbGciOi..." }, response: { ok: true } },
    [`GET ${CB}/events`]: {
        summary: "Live updates stream (Server-Sent Events)",
        description: "Open with `new EventSource(url)`. The token goes in the query string because EventSource can't send headers. Each `message` event carries a notification as JSON (new jobs, status changes).",
        query: { token: TOKEN },
        response: "event: message\ndata: {\"title\":\"New pickup request\",\"kind\":\"new_request\",\"pickupId\":\"66f2...\"}\n\n",
        responseLabel: "text/event-stream",
    },

    // ======================= Pages & misc =======================
    "GET /api-docs.json": { summary: "This documentation as OpenAPI JSON" },
    "GET /resetPassword": { summary: "Hosted reset-password page", description: "Opened from the reset emails of apps without their own reset page. `?app=` picks the API (cleanbridge, seedbridge or shared).", query: { app: "seedbridge", token: "4f9c2a7d1e...", email: "kofi.mensah@example.com" }, response: "<html>…</html>" },
    "GET /": { summary: "Landing page", response: "<html>…</html>" },
};

// Merge recorded examples (docs/apiExamples.json) under the hand-written notes.
let recorded = {};
try { recorded = require("./apiExamples.json"); } catch { /* not captured yet */ }
for (const [key, ex] of Object.entries(recorded)) {
    if (!/^[A-Z]+ \S+$/.test(key)) continue; // skip variants like "... (completed)"
    const note = (notes[key] ||= {});
    if (note.body === undefined && ex.body) note.body = ex.body;
    if (note.query === undefined && ex.query) note.query = ex.query;
    if (note.response === undefined) note.response = ex.response;
    if (note.status === undefined) note.status = ex.status;
}

module.exports = notes;
