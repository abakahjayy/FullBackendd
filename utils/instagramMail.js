const jwt = require("jsonwebtoken");
const { deliver, emailProvider } = require("./mailTransport");

// Email for the Instagram clone (React-products/Instagram): activity emails
// (new follower, comment, message while you're away) and admin "app update" emails.
// Same deliverability rules as utils/cleanbridgeMail.js: sent as EMAIL_USER via
// utils/mailTransport.js, plain text + simple HTML, RFC 8058 one-click unsubscribe.
const FROM_NAME = "Instagram Clone";
const enabled = Boolean(emailProvider);

// Links are opened on phones/other computers, so never point them at localhost.
const LIVE_SITE = "https://instagrammmm-z34p.onrender.com";
const isLocal = (url) => !url || /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(url);
const siteUrl = (path = "") => {
    const configured = process.env.INSTAGRAM_PUBLIC_URL;
    return `${(isLocal(configured) ? LIVE_SITE : configured).replace(/\/$/, "")}${path}`;
};
// The unsubscribe link must hit the server (and database) that sent the email.
const apiUrl = (path = "") => `${(process.env.ORIGIN || "http://localhost:7004").replace(/\/$/, "")}${path}`;

const PURPOSE = "instagram-unsubscribe";
const unsubscribeToken = (userId) => jwt.sign({ uid: String(userId), purpose: PURPOSE }, process.env.JWT_SECRET);
const verifyUnsubscribeToken = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== PURPOSE) throw new Error("Wrong token purpose");
    return decoded.uid;
};

const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const render = ({ name, title, message, cta, unsubscribeUrl }) => {
    const greeting = name ? `Hi ${name},` : "Hi,";
    const text = [
        greeting,
        "",
        message,
        cta ? `\n${cta.label}: ${cta.url}` : "",
        "",
        "— Instagram Clone",
        "",
        `You're receiving this because you have an account on ${siteUrl()}. Stop these emails: ${unsubscribeUrl}`,
    ].join("\n");

    const paragraphs = String(message)
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("");

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#262626;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dbdbdb;border-radius:12px;">
        <tr><td style="padding:22px 26px 6px;font-size:22px;font-weight:bold;font-family:Georgia,serif;">Instagram</td></tr>
        <tr><td style="padding:10px 26px 4px;font-size:19px;font-weight:bold;">${escapeHtml(title)}</td></tr>
        <tr><td style="padding:8px 26px 0;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</td></tr>
        <tr><td style="padding:8px 26px 8px;font-size:15px;line-height:1.6;">${paragraphs}</td></tr>
        ${cta ? `<tr><td style="padding:4px 26px 22px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#0095f6;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:bold;">${escapeHtml(cta.label)}</a></td></tr>` : ""}
        <tr><td style="padding:14px 26px 22px;border-top:1px solid #efefef;font-size:12px;line-height:1.5;color:#8e8e8e;">
          You're receiving this because you have an Instagram Clone account.
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8e8e8e;">Stop these emails</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    return { text, html };
};

// At most one email per recipient per kind in this window (e.g. a flurry of
// messages sends one "new messages" email). In memory - fine for one instance.
const THROTTLE_MS = 15 * 60 * 1000;
const lastSent = new Map();

/**
 * Send one email to a User. Never throws. Respects user.emailNotifications
 * unless force. `kind` + `throttle` limit repeats of activity emails.
 */
async function sendInstagramEmail(user, { title, message, cta, kind, throttle = false, force = false }) {
    if (!enabled || !user?.email) return false;
    if (user.emailNotifications === false && !force) return false;
    if (throttle && kind) {
        const key = `${user._id}:${kind}`;
        if (Date.now() - (lastSent.get(key) || 0) < THROTTLE_MS) return false;
        lastSent.set(key, Date.now());
    }

    const unsubscribeUrl = apiUrl(`/api/v1/instagram/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user._id))}`);
    const { text, html } = render({ name: user.firstName || user.username, title, message, cta, unsubscribeUrl });
    try {
        await deliver({
            fromName: FROM_NAME,
            replyTo: process.env.EMAIL_USER,
            to: { name: user.username, address: user.email },
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
        console.error("Instagram email failed:", err.message);
        return false;
    }
}

module.exports = { sendInstagramEmail, verifyUnsubscribeToken, siteUrl, emailEnabled: enabled };
