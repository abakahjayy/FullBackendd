const nodemailer = require("nodemailer");

// One place that actually delivers email, for every app on this backend.
//
// Render's free plan blocks outbound SMTP (ports 25/465/587 time out), so in
// production mail goes over HTTPS instead. Picked in this order:
//   1. MAIL_RELAY_URL + MAIL_RELAY_SECRET - a Google Apps Script web app that
//      sends from your own Gmail (free, Google-signed, ~100 mails/day).
//      The script is in static/gmailRelay.gs.
//   2. BREVO_API_KEY - Brevo's HTTPS API (free 300/day). The sender
//      (BREVO_SENDER_EMAIL or EMAIL_USER) must be verified in Brevo.
//   3. EMAIL_USER + EMAIL_PASS - Gmail SMTP (works locally, not on Render free).
//
// deliver({ fromName, to: { name, address } | "a@b", replyTo, subject, text, html, headers })
// resolves on success and throws on failure.

const provider = process.env.MAIL_RELAY_URL && process.env.MAIL_RELAY_SECRET
    ? "gmail-relay"
    : process.env.BREVO_API_KEY
        ? "brevo"
        : process.env.EMAIL_USER && process.env.EMAIL_PASS
            ? "smtp"
            : null;

const senderAddress = () => process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;

const toParts = (to) => (typeof to === "string" ? { address: to } : to);

const postJson = async (url, body, headers = {}) => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${raw.slice(0, 200)}`);
    return raw;
};

let smtp = null;
const smtpTransport = () => {
    smtp ||= nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        pool: true,
        maxConnections: 2,
        rateDelta: 1000,
        rateLimit: 3,
        connectionTimeout: 15000,
    });
    return smtp;
};

const deliver = async ({ fromName, to, replyTo, subject, text, html, headers }) => {
    const rcpt = toParts(to);

    if (provider === "gmail-relay") {
        // Apps Script answers 200 even on script errors, so check the body.
        const raw = await postJson(process.env.MAIL_RELAY_URL, {
            secret: process.env.MAIL_RELAY_SECRET,
            to: rcpt.address,
            name: fromName,
            replyTo,
            subject,
            text,
            html,
        });
        let out = {};
        try { out = JSON.parse(raw); } catch { throw new Error(`Relay returned non-JSON: ${raw.slice(0, 120)}`); }
        if (!out.ok) throw new Error(`Relay refused: ${out.error || "unknown error"}`);
        return;
    }

    if (provider === "brevo") {
        await postJson("https://api.brevo.com/v3/smtp/email", {
            sender: { ...(fromName ? { name: fromName } : {}), email: senderAddress() },
            to: [{ email: rcpt.address, ...(rcpt.name ? { name: rcpt.name } : {}) }],
            ...(replyTo ? { replyTo: { email: replyTo } } : {}),
            subject,
            textContent: text,
            htmlContent: html,
            ...(headers ? { headers } : {}),
        }, { "api-key": process.env.BREVO_API_KEY, accept: "application/json" });
        return;
    }

    if (provider === "smtp") {
        await smtpTransport().sendMail({
            from: fromName ? { name: fromName, address: process.env.EMAIL_USER } : process.env.EMAIL_USER,
            replyTo,
            to: rcpt,
            subject,
            text,
            html,
            headers,
        });
        return;
    }

    throw new Error("Email is not configured (set MAIL_RELAY_URL/MAIL_RELAY_SECRET, BREVO_API_KEY or EMAIL_USER/EMAIL_PASS)");
};

module.exports = { deliver, emailProvider: provider, senderAddress };
