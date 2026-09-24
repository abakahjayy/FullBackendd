const { deliver, emailProvider } = require("./mailTransport");
const jwt = require("jsonwebtoken");

// Transactional email for CleanBridge GH (pickup updates, payments, payouts).
//
// Deliverability (keeping mail out of spam):
// - Sent as EMAIL_USER itself (utils/mailTransport.js: Gmail relay on Render,
//   SMTP locally), so Google signs it and SPF/DKIM align with the From address.
//   Never spoof another From domain.
// - Every message has a plain-text part as well as simple HTML (no images, no
//   link shorteners, no ALL-CAPS/"free money" style wording).
// - RFC 8058 one-click unsubscribe headers (Gmail/Yahoo require these for
//   senders to be trusted), plus a visible unsubscribe link.
// Gmail accounts can send ~500 messages/day; move to a domain + provider
// (e.g. Brevo, Postmark) with your own SPF/DKIM/DMARC before scaling up.
const FROM_NAME = "CleanBridge GH";
const enabled = Boolean(emailProvider);

const clientUrl = (path = "") =>
    `${(process.env.CLEANBRIDGE_CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}${path}`;
// Links inside emails are opened on phones and other computers, where a
// localhost address is useless - so when this server runs locally, emails link
// to the live site instead. Override with CLEANBRIDGE_PUBLIC_URL.
const LIVE_SITE = "https://cleanbridge-gh.onrender.com";
const isLocal = (url) => !url || /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(url);
const publicBase = (override, configured, live) =>
    (override || (isLocal(configured) ? live : configured)).replace(/\/$/, "");
const emailUrl = (path = "") =>
    `${publicBase(process.env.CLEANBRIDGE_PUBLIC_URL, process.env.CLEANBRIDGE_CLIENT_URL, LIVE_SITE)}${path}`;
// The unsubscribe link must hit the server (and database) that sent the email.
const apiUrl = (path = "") =>
    `${(process.env.ORIGIN || "http://localhost:7004").replace(/\/$/, "")}${path}`;

// Long-lived, single-purpose token: it can only unsubscribe this user.
const unsubscribeToken = (userId) =>
    jwt.sign({ uid: String(userId), purpose: "cleanbridge-unsubscribe" }, process.env.JWT_SECRET);

const verifyUnsubscribeToken = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "cleanbridge-unsubscribe") throw new Error("Wrong token purpose");
    return decoded.uid;
};

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const render = ({ name, title, message, cta, unsubscribeUrl }) => {
    const greeting = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
    const text = [
        greeting,
        "",
        message,
        cta ? `\n${cta.label}: ${cta.url}` : "",
        "",
        "— CleanBridge GH",
        "",
        `You're receiving this because you have a CleanBridge GH account. Stop these emails: ${unsubscribeUrl}`,
    ].join("\n");

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1b2d2f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4ddcc;border-radius:14px;">
        <tr><td style="padding:22px 26px 6px;font-weight:bold;font-size:16px;color:#1b2d2f;">CleanBridge <span style="color:#21927b;">GH</span></td></tr>
        <tr><td style="padding:10px 26px 4px;font-size:20px;font-weight:bold;">${escapeHtml(title)}</td></tr>
        <tr><td style="padding:8px 26px 4px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</td></tr>
        <tr><td style="padding:4px 26px 12px;font-size:15px;line-height:1.6;">${escapeHtml(message)}</td></tr>
        ${cta ? `<tr><td style="padding:6px 26px 20px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#21927b;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:bold;">${escapeHtml(cta.label)}</a></td></tr>` : ""}
        <tr><td style="padding:14px 26px 22px;border-top:1px solid #eee6d6;font-size:12px;line-height:1.5;color:#6b7c7e;">
          You're receiving this because you have a CleanBridge GH account.
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7c7e;">Stop these emails</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { text, html };
};

/**
 * Send one transactional email. Never throws - email problems must not break
 * the request that triggered them.
 * user: { _id, name, email, emailNotifications }
 */
const sendCleanbridgeEmail = async (user, { title, message, cta, force = false }) => {
    if (!enabled || !user?.email) return false;
    if (user.emailNotifications === false && !force) return false;

    const token = unsubscribeToken(user._id);
    const unsubscribeUrl = apiUrl(`/api/v1/cleanbridge/email/unsubscribe?token=${encodeURIComponent(token)}`);
    const { text, html } = render({ name: user.name, title, message, cta, unsubscribeUrl });

    try {
        await deliver({
            fromName: FROM_NAME,
            replyTo: process.env.EMAIL_USER,
            to: { name: user.name, address: user.email },
            subject: title,
            text,
            html,
            headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        });
        return true;
    } catch (err) {
        console.error("CleanBridge email failed:", err.message);
        return false;
    }
};

module.exports = { sendCleanbridgeEmail, verifyUnsubscribeToken, clientUrl, emailUrl, emailEnabled: enabled };
