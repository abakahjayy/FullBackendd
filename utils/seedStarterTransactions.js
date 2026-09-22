const Transaction = require("../models/Transaction");
const starterTransactions = require("../mockData/transactions.json");

// Gives a brand-new user a few example income/expense entries so their
// Finance Tracker dashboard isn't empty on first login. Only ever called
// once, right after a user account is created.
const seedStarterTransactions = (userId) =>
    Transaction.insertMany(
        starterTransactions.map((transaction) => ({ ...transaction, userId }))
    );

module.exports = seedStarterTransactions;
