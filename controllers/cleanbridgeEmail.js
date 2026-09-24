const CleanBridgeUser = require("../models/CleanBridgeUser.js");
const { verifyUnsubscribeToken, clientUrl } = require("../utils/cleanbridgeMail.js");

// Unsubscribe from CleanBridge email updates (in-app notifications continue).
//
// GET  shows a confirmation page - link scanners/previewers open GET links,
//      so GET must not change anything.
// POST unsubscribes. This is also the RFC 8058 one-click target that Gmail
//      calls from its own "Unsubscribe" button (body: List-Unsubscribe=One-Click).

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1b2d2f}
.card{max-width:420px;margin:16px;padding:28px;background:#fff;border:1px solid #e4ddcc;border-radius:14px;text-align:center}
h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;color:#4b5d5f}button,a.btn{display:inline-block;margin-top:12px;padding:11px 18px;border:0;border-radius:9px;background:#21927b;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;cursor:pointer}</style>
</head><body><div class="card">${body}</div></body></html>`;

const unsubscribePage = async (req, res) => {
    const { token } = req.query;
    try {
        verifyUnsubscribeToken(String(token || ""));
    } catch {
        return res.status(400).send(page("Link not valid", "<h1>This link isn't valid</h1><p>You can turn email updates off from your CleanBridge profile instead.</p>"));
    }
    const safeToken = String(token).replace(/[^\w.-]/g, "");
    return res.send(page("Stop email updates", `<h1>Stop email updates?</h1>
<p>You'll stop getting CleanBridge GH emails about pickups, payments and payouts. You'll still see updates in the app.</p>
<form method="post" action="?token=${safeToken}"><button type="submit">Unsubscribe</button></form>`));
};

const unsubscribe = async (req, res) => {
    let userId;
    try {
        userId = verifyUnsubscribeToken(String(req.query.token || ""));
    } catch {
        return res.status(400).send(page("Link not valid", "<h1>This link isn't valid</h1>"));
    }
    await CleanBridgeUser.updateOne({ _id: userId }, { emailNotifications: false });
    return res.send(page("Unsubscribed", `<h1>You're unsubscribed</h1>
<p>We won't email you updates any more. You can turn them back on from your profile at any time.</p>
<a class="btn" href="${clientUrl("/profile")}">Open my profile</a>`));
};

module.exports = { unsubscribePage, unsubscribe };
