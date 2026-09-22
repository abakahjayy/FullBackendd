const Transaction = require("../models/Transaction");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

// Every handler here is mounted behind authMiddleware, so req.user.userId is
// always the logged-in user - transactions are scoped to it both on read and
// on write, so one user can never see or touch another user's data.

const getAllTransactions = async (req, res) => {
    const transactions = await Transaction.find({ userId: req.user.userId }).sort("-date");
    res.status(StatusCodes.OK).json({ nbHits: transactions.length, transactions });
};

const createTransaction = async (req, res) => {
    const { description, amount, type, category, date } = req.body;
    if (!description || !amount || !type || !date) {
        throw new BadRequestError("Please provide description, amount, type and date");
    }

    const transaction = await Transaction.create({
        userId: req.user.userId,
        description,
        amount,
        type,
        category,
        date,
    });
    res.status(StatusCodes.CREATED).json({ transaction });
};

const updateTransaction = async (req, res) => {
    const { id: transactionId } = req.params;

    const transaction = await Transaction.findOneAndUpdate(
        { _id: transactionId, userId: req.user.userId },
        req.body,
        { new: true, runValidators: true }
    );
    if (!transaction) {
        throw new NotFoundError(`No transaction with id ${transactionId}`);
    }
    res.status(StatusCodes.OK).json({ transaction });
};

const deleteTransaction = async (req, res) => {
    const { id: transactionId } = req.params;

    const transaction = await Transaction.findOneAndDelete({
        _id: transactionId,
        userId: req.user.userId,
    });
    if (!transaction) {
        throw new NotFoundError(`No transaction with id ${transactionId}`);
    }
    res.status(StatusCodes.OK).json({ msg: "Transaction deleted", transaction });
};

module.exports = {
    getAllTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
};
