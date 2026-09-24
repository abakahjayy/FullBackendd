// Gmail relay for FullBackendd (Google Apps Script web app).
//
// Render's free plan blocks SMTP, so the backend POSTs mail here over HTTPS and
// this script sends it from your own Gmail (Google-signed, lands in the inbox).
//
// Setup (once, signed in as the Gmail account that should send):
//   1. script.google.com -> New project -> paste this file.
//   2. Project Settings -> Script properties -> add RELAY_SECRET = <long random string>.
//   3. Deploy -> New deployment -> Web app; Execute as: Me; Who has access: Anyone.
//      Authorize when asked. Copy the /exec URL.
//   4. On Render: MAIL_RELAY_URL = that URL, MAIL_RELAY_SECRET = the same secret.
// After editing this script, use Deploy -> Manage deployments -> Edit -> New version.

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('RELAY_SECRET');
    if (!secret || body.secret !== secret) throw new Error('unauthorized');
    if (!body.to || !body.subject) throw new Error('to and subject are required');

    var options = {};
    if (body.html) options.htmlBody = body.html;
    if (body.name) options.name = body.name;
    if (body.replyTo) options.replyTo = body.replyTo;
    GmailApp.sendEmail(body.to, body.subject, body.text || '', options);
    out = { ok: true, remaining: MailApp.getRemainingDailyQuota() };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
