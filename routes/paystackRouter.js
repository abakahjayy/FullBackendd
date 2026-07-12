const express = require("express");
const router = express.Router();
const { initiatePayment,verifyPayment } = require("../controllers/paystackController");

router.post("/initiate", initiatePayment);
router.get("/verify/:reference", verifyPayment);


module.exports = router;
