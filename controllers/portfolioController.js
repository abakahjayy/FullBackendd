const ContactSubmission = require('../models/ContactSubmission.js');
const PortfolioOrder = require('../models/PortfolioOrder.js');
const sendEmail = require('../utils/sendEmail.js');

/**
 * Handles the portfolio "Contact" form submission.
 * Persists the submission to MongoDB and notifies the site owner by email.
 */
const submitContact = async (req, res) => {
    const body = req.body ?? {};

    if (!body.fullName || !body.email || !body.subject || !body.message) {
        return res
            .status(400)
            .json({ error: 'fullName, email, subject, and message are required' });
    }

    let submission;
    try {
        submission = await ContactSubmission.create({
            fullName: body.fullName,
            email: body.email,
            phone: body.phone,
            subject: body.subject,
            projectType: body.projectType,
            budget: body.budget,
            timeline: body.timeline,
            message: body.message,
        });
    } catch (error) {
        console.error('Failed to save contact submission:', error);
        return res.status(500).json({ error: 'Failed to save your message' });
    }

    // Best-effort notification email - don't fail the request if this errors.
    try {
        await sendEmail({
            to: process.env.EMAIL_USER,
            subject: `New portfolio contact: ${body.subject}`,
            text: `From: ${body.fullName} <${body.email}>\nPhone: ${body.phone || '-'}\nProject Type: ${body.projectType || '-'}\nBudget: ${body.budget || '-'}\nTimeline: ${body.timeline || '-'}\n\n${body.message}`,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${body.fullName}</p>
                <p><strong>Email:</strong> ${body.email}</p>
                <p><strong>Phone:</strong> ${body.phone || '-'}</p>
                <p><strong>Subject:</strong> ${body.subject}</p>
                <p><strong>Project Type:</strong> ${body.projectType || '-'}</p>
                <p><strong>Budget:</strong> ${body.budget || '-'}</p>
                <p><strong>Timeline:</strong> ${body.timeline || '-'}</p>
                <p><strong>Message:</strong><br/>${body.message}</p>
            `,
        });
    } catch (error) {
        console.error('Failed to send contact notification email:', error);
    }

    // Best-effort auto-reply to the person who submitted the form.
    try {
        await sendEmail({
            to: body.email,
            subject: `Thanks for reaching out, ${body.fullName.split(' ')[0]}!`,
            text: `Hi ${body.fullName},\n\nThanks for getting in touch! I've received your message about "${body.subject}" and will get back to you as soon as possible, usually within 1-2 business days.\n\nFor your records, here's what you sent:\n"${body.message}"\n\nTalk soon,\nJoshua`,
            html: `
                <p>Hi ${body.fullName},</p>
                <p>Thanks for getting in touch! I've received your message about <strong>${body.subject}</strong> and will get back to you as soon as possible, usually within 1-2 business days.</p>
                <p>For your records, here's what you sent:</p>
                <blockquote>${body.message}</blockquote>
                <p>Talk soon,<br/>Joshua</p>
            `,
        });
    } catch (error) {
        console.error('Failed to send contact auto-reply email:', error);
    }

    return res.status(201).json({ success: true, submission });
};

/**
 * Handles the portfolio "Order a Website" form submission.
 * Persists the submission to MongoDB and notifies the site owner by email.
 */
const submitOrder = async (req, res) => {
    const body = req.body ?? {};

    if (
        !body.name ||
        !body.email ||
        !body.projectType ||
        !body.projectDescription ||
        typeof body.agreeToBeContacted === 'undefined'
    ) {
        return res.status(400).json({
            error:
                'name, email, projectType, projectDescription, and agreeToBeContacted are required',
        });
    }

    let submission;
    try {
        submission = await PortfolioOrder.create({
            businessName: body.businessName,
            name: body.name,
            email: body.email,
            phone: body.phone,
            projectType: body.projectType,
            websitePages: body.websitePages,
            featuresNeeded: body.featuresNeeded,
            budget: body.budget,
            deadline: body.deadline,
            referenceWebsite: body.referenceWebsite,
            projectDescription: body.projectDescription,
            preferredContactMethod: body.preferredContactMethod,
            agreeToBeContacted: Boolean(body.agreeToBeContacted),
        });
    } catch (error) {
        console.error('Failed to save order submission:', error);
        return res.status(500).json({ error: 'Failed to save your order' });
    }

    // Best-effort notification email - don't fail the request if this errors.
    try {
        await sendEmail({
            to: process.env.EMAIL_USER,
            subject: `New website order: ${body.projectType}`,
            text: `From: ${body.name} <${body.email}>\nBusiness: ${body.businessName || '-'}\nPhone: ${body.phone || '-'}\nProject Type: ${body.projectType}\nBudget: ${body.budget || '-'}\nDeadline: ${body.deadline || '-'}\nPreferred Contact: ${body.preferredContactMethod || '-'}\nReference Website: ${body.referenceWebsite || '-'}\n\n${body.projectDescription}`,
            html: `
                <h3>New Website Order Submission</h3>
                <p><strong>Name:</strong> ${body.name}</p>
                <p><strong>Business:</strong> ${body.businessName || '-'}</p>
                <p><strong>Email:</strong> ${body.email}</p>
                <p><strong>Phone:</strong> ${body.phone || '-'}</p>
                <p><strong>Project Type:</strong> ${body.projectType}</p>
                <p><strong>Pages:</strong> ${body.websitePages || '-'}</p>
                <p><strong>Features:</strong> ${body.featuresNeeded || '-'}</p>
                <p><strong>Budget:</strong> ${body.budget || '-'}</p>
                <p><strong>Deadline:</strong> ${body.deadline || '-'}</p>
                <p><strong>Reference Website:</strong> ${body.referenceWebsite || '-'}</p>
                <p><strong>Preferred Contact Method:</strong> ${body.preferredContactMethod || '-'}</p>
                <p><strong>Description:</strong><br/>${body.projectDescription}</p>
            `,
        });
    } catch (error) {
        console.error('Failed to send order notification email:', error);
    }

    // Best-effort auto-reply to the person who submitted the form.
    try {
        await sendEmail({
            to: body.email,
            subject: `Thanks for your order request, ${body.name.split(' ')[0]}!`,
            text: `Hi ${body.name},\n\nThanks for requesting a ${body.projectType}! I've received the details and will review your project and get back to you as soon as possible, usually within 1-2 business days.\n\nFor your records, here's a summary of what you sent:\nProject Type: ${body.projectType}\nBudget: ${body.budget || 'Not specified'}\nDeadline: ${body.deadline || 'Not specified'}\nDescription: ${body.projectDescription}\n\nTalk soon,\nJoshua`,
            html: `
                <p>Hi ${body.name},</p>
                <p>Thanks for requesting a <strong>${body.projectType}</strong>! I've received the details and will review your project and get back to you as soon as possible, usually within 1-2 business days.</p>
                <p>For your records, here's a summary of what you sent:</p>
                <ul>
                    <li><strong>Project Type:</strong> ${body.projectType}</li>
                    <li><strong>Budget:</strong> ${body.budget || 'Not specified'}</li>
                    <li><strong>Deadline:</strong> ${body.deadline || 'Not specified'}</li>
                </ul>
                <p><strong>Description:</strong><br/>${body.projectDescription}</p>
                <p>Talk soon,<br/>Joshua</p>
            `,
        });
    } catch (error) {
        console.error('Failed to send order auto-reply email:', error);
    }

    return res.status(201).json({ success: true, submission });
};

module.exports = { submitContact, submitOrder };
