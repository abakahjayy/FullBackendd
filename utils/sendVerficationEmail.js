const sendEmail = require('./sendEmail');

const sendVerificationEmail = async ({
  name,
  email,
  verificationToken,
  origin,
}) => {
  const verifyEmail = `${origin}api/v1/auth/verify-email?token=${verificationToken}&email=${email}`;

  const message = `<p>Please confirm your email by clicking on the following link :
  <a href="${verifyEmail}">Verify Email</a> </p>`;
  const text='Verify Email for more Functionality';

  return sendEmail({
    to: email,
    subject: 'Email Confirmation',
    html: `<h4> Hello, ${name}</h4>
    ${message}
    `,
    text,
  });
};

module.exports = sendVerificationEmail;
