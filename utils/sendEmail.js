const { deliver } = require('./mailTransport');

// Shared-app email (OpenLabs/SeedBridge). Delivery (Gmail relay, Brevo or SMTP)
// is chosen in utils/mailTransport.js. Never throws.
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await deliver({ to, replyTo: process.env.EMAIL_USER, subject, text, html });
    console.log('Email sent to', to);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    return false;
  }
};

module.exports = sendEmail;
