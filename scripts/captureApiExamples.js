// Records real request/response examples for the CleanBridge API docs.
//
//   1. Start a throwaway server on an EMPTY database with email off, so no real
//      user's data can end up in the (public) docs:
//        MONGO_URI=mongodb://localhost:27017/cleanbridge_docs_tmp PORT=7010 EMAIL_USER= EMAIL_PASS= MAIL_RELAY_URL= BREVO_API_KEY= node app.js
//   2. MONGO_URI=mongodb://localhost:27017/cleanbridge_docs_tmp node scripts/captureApiExamples.js
//
// It signs up temporary @example.com users, walks a full pickup (book -> accept
// -> collect -> rate -> payout), writes docs/apiExamples.json (shown in
// /api-docs by utils/apiDocs.js) and deletes everything it created.
require("dotenv").config({ quiet: true });
if (!/_docs_tmp$/.test(process.env.MONGO_URI || "")) {
    console.error("Refusing to run: set MONGO_URI to a throwaway database ending in _docs_tmp (see the top of this file).");
    process.exit(1);
}
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const ROOT = process.env.CAPTURE_URL || "http://localhost:7010";
const CB = "/api/v1/cleanbridge";
const tag = `docs${Date.now().toString(36)}`;
const examples = {};

// Keep examples short: first 4 items of any list, long strings cut.
const trim = (v, depth = 0) => {
    if (Array.isArray(v)) return v.slice(0, 4).map((x) => trim(x, depth + 1));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]));
    if (typeof v === "string" && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    if (typeof v === "string" && v.length > 160) return `${v.slice(0, 157)}...`;
    return v;
};
const anonymise = (v) => JSON.parse(JSON.stringify(v).replaceAll(tag, "example"));

const call = async (method, route, { body, token, query, key, record = true } = {}) => {
    const url = new URL(ROOT + route);
    Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    const label = `${method} ${route.replace(/\/[0-9a-f]{24}(?=\/|$)/g, "/:id")}`;
    console.log(res.status, label);
    if (!res.ok) console.log("   ", JSON.stringify(json).slice(0, 300));
    if (record && res.ok) {
        const docKey = key || label;
        examples[docKey] = anonymise({
            status: res.status,
            ...(body ? { body: trim(body) } : {}),
            ...(query ? { query } : {}),
            response: trim(json),
        });
    }
    return json;
};

(async () => {
    const created = { users: [], emails: [] };
    try {
        const mk = (role, extra = {}) => ({
            name: `${role[0].toUpperCase()}${role.slice(1)} Example`, email: `${role}.${tag}@example.com`,
            phone: `0${role === "customer" ? 24 : role === "collector" ? 55 : 20}${String(Date.now()).slice(-7)}`,
            password: "Secret123!", role, ...extra,
        });
        const customer = await call("POST", `${CB}/auth/signup`, { body: mk("customer", { area: "East Legon", address: "12 Lagos Ave, East Legon" }) });
        const collector = await call("POST", `${CB}/auth/signup`, { body: mk("collector"), record: false });
        const admin = await call("POST", `${CB}/auth/signup`, { body: mk("admin", { adminKey: process.env.CLEANBRIDGE_ADMIN_SIGNUP_KEY }), record: false });
        const C = customer.token, K = collector.token, A = admin.token;
        created.emails.push(customer.user.email, collector.user.email, admin.user.email);

        await call("POST", `${CB}/auth/login`, { body: { identifier: customer.user.email, password: "Secret123!" } });
        await call("GET", `${CB}/auth/me`, { token: C });
        await call("PATCH", `${CB}/auth/me`, { token: C, body: { address: "12 Lagos Ave, East Legon", region: "Greater Accra", ghanaPostGps: "GA-183-8164", location: { lat: 5.6363, lng: -0.1614 } } });
        await call("PUT", `${CB}/auth/me/live-location`, { token: K, body: { lat: 5.6301, lng: -0.1702 } });
        await call("POST", `${CB}/auth/forgot-password`, { body: { email: customer.user.email, redirect_uri: "http://localhost:5173/reset-password" }, record: false });
        examples[`POST ${CB}/auth/forgot-password`] = { status: 200, body: { email: "kofi.mensah@example.com", redirect_uri: "https://cleanbridge-gh.onrender.com/reset-password" }, response: { message: "If an account exists for that email, a password reset link has been sent." } };

        await call("GET", `${CB}/settings`);
        await call("GET", `${CB}/geo/hubs`);
        await call("GET", `${CB}/geo/search`, { query: { q: "Accra Mall", lat: "5.6037", lng: "-0.187" } });
        await call("GET", `${CB}/geo/reverse`, { query: { lat: "5.6363", lng: "-0.1614" } });

        // Collector gets a verified vehicle and goes on duty.
        await call("PUT", `${CB}/vehicles/me`, { token: K, body: { label: "Blue aboboyaa", type: "Motor tricycle (Aboboyaa)", make: "Apsonic", model: "Cargo 200", registration: "GR 1234-24", fuelType: "Petrol", fuelEconomyLPer100Km: 4.5, capacityTonnes: 0.5 } });
        await call("GET", `${CB}/vehicles/me`, { token: K });
        const vehicles = await call("GET", `${CB}/vehicles`, { token: A, query: { verificationStatus: "pending" } });
        const vehicle = vehicles.vehicles.find((v) => v.collectorId === collector.user.id) || vehicles.vehicles[0];
        await call("PATCH", `${CB}/vehicles/${vehicle.id}/verification`, { token: A, body: { verificationStatus: "verified" } });
        await call("PATCH", `${CB}/auth/me`, { token: K, body: { collectorStatus: "available", momoNumber: collector.user.phone }, record: false });

        const where = { lat: 5.6363, lng: -0.1614 };
        await call("GET", `${CB}/pickups/vehicle-options`, { query: { lat: String(where.lat), lng: String(where.lng), bags: "3", wasteType: "Household mix" } });
        await call("POST", `${CB}/pickups/quote`, { body: { location: where, wasteType: "Household mix", bags: 3, urgent: false, vehicleType: "Motor tricycle (Aboboyaa)", scheduledDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) } });
        const booked = await call("POST", `${CB}/pickups`, { token: C, body: {
            area: "East Legon", address: "12 Lagos Ave, East Legon", gateNote: "Blue gate, call on arrival", wasteType: "Household mix", bags: 3,
            scheduledDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), timeWindow: "Morning (7:00 – 10:00)", urgent: false,
            location: where, region: "Greater Accra", ghanaPostGps: "GA-183-8164", paymentMethod: "cash", vehicleType: "Motor tricycle (Aboboyaa)",
        } });
        const pid = booked.pickup.id;
        await call("GET", `${CB}/pickups`, { token: C, query: { limit: "5" } });
        await call("GET", `${CB}/pickups/available`, { token: K });
        await call("GET", `${CB}/pickups/${pid}`, { token: C });
        await call("PATCH", `${CB}/pickups/${pid}/accept`, { token: K });
        await call("POST", `${CB}/routes`, { token: K, body: { date: new Date().toISOString().slice(0, 10), stops: [pid], distanceKm: 6.4 } });
        const today = await call("GET", `${CB}/routes/today`, { token: K });
        await call("GET", `${CB}/routes`, { token: K });
        const routeId = today?.route?.id;
        if (routeId) {
            await call("GET", `${CB}/routes/${routeId}`, { token: K });
            await call("PATCH", `${CB}/routes/${routeId}/status`, { token: K, body: { status: "in_progress" } });
        }
        await call("PATCH", `${CB}/pickups/${pid}/status`, { token: K, body: { status: "on_the_way", etaMinutes: 15 } });
        await call("PATCH", `${CB}/pickups/${pid}/status`, { token: K, body: { status: "completed" }, key: `PATCH ${CB}/pickups/:id/status (completed)` });
        await call("POST", `${CB}/pickups/${pid}/rate`, { token: C, body: { rating: 5 } });

        await call("GET", `${CB}/notifications`, { token: C });
        const notes = await call("GET", `${CB}/notifications`, { token: C, query: { unread: "true" }, record: false });
        if (notes?.notifications?.[0]) await call("PATCH", `${CB}/notifications/${notes.notifications[0].id}/read`, { token: C });
        await call("PATCH", `${CB}/notifications/read-all`, { token: C });

        await call("GET", `${CB}/dashboard/customer`, { token: C });
        await call("GET", `${CB}/dashboard/collector`, { token: K });
        await call("GET", `${CB}/dashboard/admin`, { token: A });
        await call("GET", `${CB}/dashboard/analytics`, { token: A, query: { days: "30" } });

        await call("GET", `${CB}/payouts/balance`, { token: K });
        const bal = await call("GET", `${CB}/payouts/balance`, { token: K, record: false });
        const amt = Math.max(bal?.minimumPayout || 1, 1);
        const payout = await call("POST", `${CB}/payouts`, { token: K, body: { amount: amt } });
        await call("GET", `${CB}/payouts`, { token: K });
        if (payout?.payout?.id) await call("PATCH", `${CB}/payouts/${payout.payout.id}`, { token: A, body: { status: "paid", reference: "MTN-TX-889201", note: "Sent via MTN MoMo" } });

        await call("GET", `${CB}/admin/customers`, { token: A, query: { q: "example" } });
        await call("GET", `${CB}/admin/collectors`, { token: A });
        await call("GET", `${CB}/admin/live`, { token: A });
        const made = await call("POST", `${CB}/admin/users`, { token: A, body: { name: "Yaw Example", email: `yaw.${tag}@example.com`, phone: `026${String(Date.now()).slice(-7)}`, password: "Secret123!", role: "collector", area: "Madina" } });
        if (made?.user) {
            created.emails.push(made.user.email);
            await call("PATCH", `${CB}/admin/users/${made.user.id}/active`, { token: A, body: { isActive: false } });
        }
        // Broadcast would reach real users - documented by hand in docs/apiAnnotations.js.
        // Settings: write back the current values so nothing changes.
        const current = await call("GET", `${CB}/settings`, { record: false });
        const p = current.settings?.payouts || current.payouts || {};
        if (p.collectorSharePct != null) await call("PUT", `${CB}/settings/payouts`, { token: A, body: { collectorSharePct: p.collectorSharePct, minimumPayout: p.minimumPayout } });

        // Customer deletes a second, throwaway account.
        const temp = await call("POST", `${CB}/auth/signup`, { body: { ...mk("customer"), email: `temp.${tag}@example.com`, phone: `027${String(Date.now()).slice(-7)}` }, record: false });
        created.emails.push(temp.user.email);
        await call("DELETE", `${CB}/auth/me`, { token: temp.token, body: { confirm: "DELETE" } });

        const out = path.join(__dirname, "..", "docs", "apiExamples.json");
        fs.writeFileSync(out, JSON.stringify(examples, null, 2) + "\n");
        console.log(`\nWrote ${Object.keys(examples).length} examples to docs/apiExamples.json`);
    } finally {
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = mongoose.connection.db;
        const users = await db.collection("cleanbridgeusers").find({ email: { $regex: `${tag}@example\\.com$` } }).toArray();
        const ids = users.map((u) => u._id);
        const pickups = await db.collection("cleanbridgepickups").find({ $or: [{ customerId: { $in: ids } }, { collectorId: { $in: ids } }] }).toArray();
        await db.collection("cleanbridgenotifications").deleteMany({ pickupId: { $in: pickups.map((p) => p._id) } });
        await db.collection("cleanbridgepickups").deleteMany({ _id: { $in: pickups.map((p) => p._id) } });
        for (const c of ["cleanbridgenotifications", "cleanbridgevehicles", "cleanbridgeroutes", "cleanbridgepayouts"]) {
            await db.collection(c).deleteMany({ $or: [{ userId: { $in: ids } }, { collectorId: { $in: ids } }] });
        }
        await db.collection("cleanbridgeusers").deleteMany({ _id: { $in: ids } });
        console.log(`Cleaned up ${ids.length} users, ${pickups.length} pickups`);
        await db.dropDatabase(); // the throwaway *_docs_tmp database
        console.log("Dropped", db.databaseName);
        await mongoose.disconnect();
    }
})();
