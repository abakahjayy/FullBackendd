// models/Orders.js
const mongoose = require('mongoose');

const MTNOrderSchema = new mongoose.Schema({
    recipient: String,
    quantity: String,
    network: String,
    price: String,
    payment: String,  // store paymentReference here
    status: {
        type: String,
        enum: ['Pending', 'Delivered', 'Failed'],
        default: 'Pending'
    },
    updated: String,
    email: String,             // optional, new field
    transactionId: String,     // optional, Paystack transaction ID
}, { timestamps: true });

module.exports = mongoose.model('MTNOrders', MTNOrderSchema);
