const jwt = require("jsonwebtoken");
const { deliver, emailProvider } = require("./mailTransport");

// Email for GH-GPT (GHGPT-main/Chatbot): welcome, new sign-in alerts and
// "email me this chat". Same deliverability rules as utils/instagramMail.js:
// sent as EMAIL_USER via utils/mailTransport.js, plain text + simple HTML,
// RFC 8058 one-click unsubscribe. GH-GPT has its own opt-out
// (User.ghgptEmailNotifications) because User is shared with other apps.
const FROM_NAME = "GH-GPT";
const enabled = Boolean(emailProvider);

// Links are opened on phones/other computers, so never point them at localhost.
const LIVE_SITE = "https://gh-gpt.onrender.com";
const isLocal = (url) => !url || /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(url);
const siteUrl = (path = "") => {
    const configured = process.env.GHGPT_PUBLIC_URL || process.env.CLIENT_URL_AI;
    return `${(isLocal(configured) ? LIVE_SITE : configured).replace(/\/$/, "")}${path}`;
};
// The unsubscribe link must hit the server (and database) that sent the email.
const apiUrl = (path = "") => `${(process.env.ORIGIN || "http://localhost:7004").replace(/\/$/, "")}${path}`;

const PURPOSE = "ghgpt-unsubscribe";
const unsubscribeToken = (userId) => jwt.sign({ uid: String(userId), purpose: PURPOSE }, process.env.JWT_SECRET);
const verifyUnsubscribeToken = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== PURPOSE) throw new Error("Wrong token purpose");
    return decoded.uid;
};

const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// `blocks` (optional) renders a conversation: [{ who: 'You'|'GH-GPT', text }].
const render = ({ name, title, message, blocks, cta, unsubscribeUrl }) => {
    const greeting = name ? `Hi ${name},` : "Hi,";
    const text = [
        greeting,
        "",
        message,
        ...(blocks || []).map((b) => `\n${b.who}:\n${b.text}`),
        cta ? `\n${cta.label}: ${cta.url}` : "",
        "",
        "— GH-GPT",
        "",
        `You're receiving this because you have a GH-GPT account (${siteUrl()}). Stop these emails: ${unsubscribeUrl}`,
    ].join("\n");

    const paragraphs = String(message || "")
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("");

    const convo = (blocks || [])
        .map((b) => {
            const isUser = b.who === "You";
            return `<tr><td style="padding:6px 26px;">
  <div style="font-size:12px;font-weight:bold;color:${isUser ? "#2b6cb0" : "#2f855a"};margin-bottom:4px;">${escapeHtml(b.who)}</div>
  <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;background:${isUser ? "#ebf4ff" : "#f7f7f9"};border-radius:10px;padding:10px 12px;">${escapeHtml(b.text)}</div>
</td></tr>`;
        })
        .join("");

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a202c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;">
        <tr><td style="padding:22px 26px 6px;font-size:22px;font-weight:800;">
          <span style="color:#ce1126;">GH</span><span style="color:#d69e2e;">-</span><span style="color:#007940;">GPT</span>
        </td></tr>
        <tr><td style="padding:10px 26px 4px;font-size:19px;font-weight:bold;">${escapeHtml(title)}</td></tr>
        <tr><td style="padding:8px 26px 0;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</td></tr>
        <tr><td style="padding:8px 26px 8px;font-size:15px;line-height:1.6;">${paragraphs}</td></tr>
        ${convo}
        ${cta ? `<tr><td style="padding:12px 26px 22px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#3182ce;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:bold;">${escapeHtml(cta.label)}</a></td></tr>` : ""}
        <tr><td style="padding:14px 26px 22px;border-top:1px solid #edf2f7;font-size:12px;line-height:1.5;color:#718096;">
          You're receiving this because you have a GH-GPT account.
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#718096;">Stop these emails</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    return { text, html };
};

/**
 * Send one email to a User. Never throws; resolves true when sent.
 * Respects user.ghgptEmailNotifications unless `force` (security alerts,
 * emails the user explicitly asked for).
 */
async function sendGhgptEmail(user, { title, message, blocks, cta, force = false }) {
    if (!enabled || !user?.email) return false;
    if (user.ghgptEmailNotifications === false && !force) return false;

    const unsubscribeUrl = apiUrl(`/api/v1/ghgpt/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user._id))}`);
    const { text, html } = render({ name: user.firstName || user.username, title, message, blocks, cta, unsubscribeUrl });
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
        console.error("GH-GPT email failed:", err.message);
        return false;
    }
}

module.exports = { sendGhgptEmail, verifyUnsubscribeToken, siteUrl, emailEnabled: enabled };
