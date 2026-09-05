const mongoose = require('mongoose');

const ContactSubmissionSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, 'Please provide the full name'],
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'],
        },
        phone: {
            type: String,
        },
        subject: {
            type: String,
            required: [true, 'Please provide a subject'],
        },
        projectType: {
            type: String,
        },
        budget: {
            type: String,
        },
        timeline: {
            type: String,
        },
        message: {
            type: String,
            required: [true, 'Please provide a message'],
        },
    },
    { timestamps: true },
);

const ContactSubmission = mongoose.model('ContactSubmission', ContactSubmissionSchema);
module.exports = ContactSubmission;
