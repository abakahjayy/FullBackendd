const ContactSubmission = require('../models/ContactSubmission.js');
const PortfolioOrder = require('../models/PortfolioOrder.js');
const { deliver } = require('../utils/mailTransport.js');

// Portfolio (portfolio-8jmo.onrender.com) "Contact" and "Order a Website" forms.
// Each submission is saved, then two emails go out from the owner's Gmail
// (utils/mailTransport.js relay): an alert to the owner (Reply goes straight to the
// visitor) and an instant auto-reply to the visitor. The request is answered as soon
// as the submission is saved; the emails are sent in the background, in parallel,
// so the form never waits on email. Everything the visitor typed is HTML-escaped -
// these emails come from the owner's address, so they must never carry injected markup.

const PORTFOLIO_URL = 'https://portfolio-8jmo.onrender.com';
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// app.js runs xss-clean on every body, which turns "<" into "&lt;" before we see it.
// Undo that so emails show what the visitor actually typed, then esc() once for HTML
// (plain-text parts need no escaping).
const decode = (v) =>
    String(v ?? '').replace(/&(lt|gt|quot|#39|#x27|amp);/g, (m, e) => ({ lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", amp: '&' }[e]));
const clip = (v, n = 2000) => decode(v).slice(0, n);
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// Simple, spam-safe layout: plain text + light HTML, no images or tracking.
const layout = (title, bodyHtml) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0b1220;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111a2e;border:1px solid #1e2a44;border-radius:14px;">
        <tr><td style="padding:22px 26px 4px;font-size:18px;font-weight:bold;color:#38bdf8;">Joshua.Dev</td></tr>
        <tr><td style="padding:8px 26px 24px;font-size:15px;line-height:1.65;">${bodyHtml}</td></tr>
        <tr><td style="padding:14px 26px 22px;border-top:1px solid #1e2a44;font-size:12px;color:#94a3b8;">
          Abakah Joshua · Full-stack developer · <a href="${PORTFOLIO_URL}" style="color:#94a3b8;">${PORTFOLIO_URL.replace('https://', '')}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const rows = (pairs) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0;font-size:14px;">${pairs
        .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#94a3b8;vertical-align:top;">${esc(k)}</td><td style="padding:3px 0;">${esc(v || '-')}</td></tr>`)
        .join('')}</table>`;
const quote = (text) =>
    `<div style="margin:10px 0;padding:12px 14px;background:#0b1220;border-left:3px solid #38bdf8;border-radius:6px;white-space:pre-wrap;">${esc(text)}</div>`;

// Background: never delays the response, never throws.
const sendInBackground = (label, emails) => {
    Promise.allSettled(emails.map((m) => deliver(m))).then((results) =>
        results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`${label} email ${i + 1} failed:`, r.reason?.message || r.reason);
            else console.log(`${label} email ${i + 1} sent`);
        })
    );
};

/**
 * Handles the portfolio "Contact" form submission.
 */
const submitContact = async (req, res) => {
    const body = req.body ?? {};

    if (!body.fullName || !body.email || !body.subject || !body.message) {
        return res.status(400).json({ error: 'fullName, email, subject, and message are required' });
    }
    if (!EMAIL_RE.test(String(body.email))) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    let submission;
    try {
        submission = await ContactSubmission.create({
            fullName: clip(body.fullName, 120),
            email: clip(body.email, 200),
            phone: clip(body.phone, 40),
            subject: clip(body.subject, 200),
            projectType: clip(body.projectType, 100),
            budget: clip(body.budget, 100),
            timeline: clip(body.timeline, 100),
            message: clip(body.message, 5000),
        });
    } catch (error) {
        console.error('Failed to save contact submission:', error);
        return res.status(500).json({ error: 'Failed to save your message' });
    }

    res.status(201).json({ success: true, submission });

    const s = submission;
    sendInBackground('Contact', [
        {
            fromName: 'Portfolio contact form',
            to: process.env.EMAIL_USER,
            replyTo: s.email, // hit Reply to answer the visitor directly
            subject: `New portfolio contact: ${s.subject}`,
            text: `From: ${s.fullName} <${s.email}>\nPhone: ${s.phone || '-'}\nProject type: ${s.projectType || '-'}\nBudget: ${s.budget || '-'}\nTimeline: ${s.timeline || '-'}\n\n${s.message}`,
            html: layout('New portfolio contact', `<p style="margin:0 0 6px;font-weight:bold;">New message from ${esc(s.fullName)}</p>
                ${rows([['Email', s.email], ['Phone', s.phone], ['Subject', s.subject], ['Project type', s.projectType], ['Budget', s.budget], ['Timeline', s.timeline]])}
                ${quote(s.message)}<p style="margin:12px 0 0;color:#94a3b8;font-size:13px;">Reply to this email to answer ${esc(firstName(s.fullName))} directly.</p>`),
        },
        {
            fromName: 'Abakah Joshua',
            to: { name: s.fullName, address: s.email },
            replyTo: process.env.EMAIL_USER,
            subject: `Thanks for reaching out, ${firstName(s.fullName)}!`,
            text: `Hi ${firstName(s.fullName)},\n\nThanks for getting in touch! I've received your message about "${s.subject}" and I'll get back to you within 1-2 business days - usually sooner.\n\nFor your records, here's what you sent:\n"${s.message}"\n\nYou can reply to this email if you'd like to add anything.\n\nTalk soon,\nJoshua\n${PORTFOLIO_URL}`,
            html: layout('Thanks for reaching out', `<p style="margin:0 0 12px;">Hi ${esc(firstName(s.fullName))},</p>
                <p style="margin:0 0 12px;">Thanks for getting in touch! I've received your message about <strong>${esc(s.subject)}</strong> and I'll get back to you within <strong>1-2 business days</strong> - usually sooner.</p>
                <p style="margin:0;color:#94a3b8;">For your records, here's what you sent:</p>${quote(s.message)}
                <p style="margin:12px 0;">You can reply to this email if you'd like to add anything.</p>
                <p style="margin:0;">Talk soon,<br/>Joshua</p>`),
        },
    ]);
};

/**
 * Handles the portfolio "Order a Website" form submission.
 */
const submitOrder = async (req, res) => {
    const body = req.body ?? {};

    if (!body.name || !body.email || !body.projectType || !body.projectDescription || typeof body.agreeToBeContacted === 'undefined') {
        return res.status(400).json({
            error: 'name, email, projectType, projectDescription, and agreeToBeContacted are required',
        });
    }
    if (!EMAIL_RE.test(String(body.email))) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    let submission;
    try {
        submission = await PortfolioOrder.create({
            businessName: clip(body.businessName, 200),
            name: clip(body.name, 120),
            email: clip(body.email, 200),
            phone: clip(body.phone, 40),
            projectType: clip(body.projectType, 100),
            websitePages: clip(body.websitePages, 300),
            featuresNeeded: clip(Array.isArray(body.featuresNeeded) ? body.featuresNeeded.join(', ') : body.featuresNeeded, 1000), // stored as text
            budget: clip(body.budget, 100),
            deadline: clip(body.deadline, 100),
            referenceWebsite: clip(body.referenceWebsite, 300),
            projectDescription: clip(body.projectDescription, 5000),
            preferredContactMethod: clip(body.preferredContactMethod, 50),
            agreeToBeContacted: Boolean(body.agreeToBeContacted),
        });
    } catch (error) {
        console.error('Failed to save order submission:', error);
        return res.status(500).json({ error: 'Failed to save your order' });
    }

    res.status(201).json({ success: true, submission });

    const s = submission;
    const features = s.featuresNeeded;
    sendInBackground('Order', [
        {
            fromName: 'Portfolio order form',
            to: process.env.EMAIL_USER,
            replyTo: s.email,
            subject: `New website request: ${s.projectType}${s.businessName ? ` for ${s.businessName}` : ''}`,
            text: `From: ${s.name} <${s.email}>\nBusiness: ${s.businessName || '-'}\nPhone: ${s.phone || '-'}\nProject type: ${s.projectType}\nPages: ${s.websitePages || '-'}\nFeatures: ${features || '-'}\nBudget: ${s.budget || '-'}\nDeadline: ${s.deadline || '-'}\nReference: ${s.referenceWebsite || '-'}\nPreferred contact: ${s.preferredContactMethod || '-'}\n\n${s.projectDescription}`,
            html: layout('New website request', `<p style="margin:0 0 6px;font-weight:bold;">New website request from ${esc(s.name)}</p>
                ${rows([['Business', s.businessName], ['Email', s.email], ['Phone', s.phone], ['Project type', s.projectType], ['Pages', s.websitePages], ['Features', features], ['Budget', s.budget], ['Deadline', s.deadline], ['Reference', s.referenceWebsite], ['Preferred contact', s.preferredContactMethod]])}
                ${quote(s.projectDescription)}<p style="margin:12px 0 0;color:#94a3b8;font-size:13px;">Reply to this email to answer ${esc(firstName(s.name))} directly.</p>`),
        },
        {
            fromName: 'Abakah Joshua',
            to: { name: s.name, address: s.email },
            replyTo: process.env.EMAIL_USER,
            subject: `Your website request is in, ${firstName(s.name)}!`,
            text: `Hi ${firstName(s.name)},\n\nThanks for requesting a ${s.projectType}! I've received your project details.\n\nWhat happens next:\n1. I review your request (within 1-2 business days).\n2. I reach out${s.preferredContactMethod ? ` by ${s.preferredContactMethod}` : ''} with questions, a quote and a timeline.\n3. Once you're happy, we start building.\n\nYour request:\nProject type: ${s.projectType}\nBudget: ${s.budget || 'Not specified'}\nDeadline: ${s.deadline || 'Not specified'}\n\n${s.projectDescription}\n\nReply to this email any time to add details.\n\nTalk soon,\nJoshua\n${PORTFOLIO_URL}`,
            html: layout('Your website request is in', `<p style="margin:0 0 12px;">Hi ${esc(firstName(s.name))},</p>
                <p style="margin:0 0 12px;">Thanks for requesting a <strong>${esc(s.projectType)}</strong>! I've received your project details.</p>
                <p style="margin:0 0 6px;font-weight:bold;">What happens next</p>
                <ol style="margin:0 0 12px;padding-left:20px;">
                  <li>I review your request (within 1-2 business days).</li>
                  <li>I reach out${s.preferredContactMethod ? ` by ${esc(s.preferredContactMethod)}` : ''} with questions, a quote and a timeline.</li>
                  <li>Once you're happy, we start building.</li>
                </ol>
                ${rows([['Project type', s.projectType], ['Budget', s.budget || 'Not specified'], ['Deadline', s.deadline || 'Not specified']])}
                ${quote(s.projectDescription)}
                <p style="margin:12px 0;">Reply to this email any time to add details.</p>
                <p style="margin:0;">Talk soon,<br/>Joshua</p>`),
        },
    ]);
};

module.exports = { submitContact, submitOrder };
