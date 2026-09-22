const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.js");

const {
    getAllTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
} = require("../controllers/transactions.js");

router.use(authMiddleware);

router.route("/").get(getAllTransactions).post(createTransaction);
router.route("/:id").patch(updateTransaction).delete(deleteTransaction);

module.exports = router;
