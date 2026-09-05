const mongoose = require('mongoose');

const PortfolioOrderSchema = new mongoose.Schema(
    {
        businessName: {
            type: String,
        },
        name: {
            type: String,
            required: [true, 'Please provide your name'],
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'],
        },
        phone: {
            type: String,
        },
        projectType: {
            type: String,
            required: [true, 'Please provide a project type'],
        },
        websitePages: {
            type: String,
        },
        featuresNeeded: {
            type: String,
        },
        budget: {
            type: String,
        },
        deadline: {
            type: String,
        },
        referenceWebsite: {
            type: String,
        },
        projectDescription: {
            type: String,
            required: [true, 'Please describe the project'],
        },
        preferredContactMethod: {
            type: String,
        },
        agreeToBeContacted: {
            type: Boolean,
            required: [true, 'Please confirm you agree to be contacted'],
        },
    },
    { timestamps: true },
);

// Registered as "PortfolioOrder" (not "Orders") to avoid clashing with the
// existing e-commerce Orders model used elsewhere in this backend.
const PortfolioOrder = mongoose.model('PortfolioOrder', PortfolioOrderSchema);
module.exports = PortfolioOrder;
