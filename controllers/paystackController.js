const MTNOrder = require("../models/MTNOrders"); // existing order model
const AFARegistration = require("../models/AFAResgistration"); // <-- replace with your actual model/path
const axios = require("axios");

const PAYSTACK_SECRET_KEY = process.env.TEST_PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_CALLBACK_URL = process.env.ORIGIN + process.env.PAYSTACK_CALLBACK_URL; // ensure this is set

exports.initiatePayment = async (req, res) => {
  // Accept optional metadata from frontend (e.g. { type: 'afa_registration', fullname, idnumber, ... })
  const { email, amount, phone, channel, quantity, operatorId, metadata = {} } = req.body;
  try {
    // Build metadata to send to Paystack: always include phone/quantity/operatorId and any extra metadata
    const metaToSend = Object.assign({}, { phone, quantity, operatorId }, metadata);

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        // IMPORTANT: your frontend should send amount in GHS (e.g. 10 for GHS 10)
        // because this server multiplies by 100 below to get pesewas/kobo
        amount: amount * 100,
        channels: channel,
        metadata: metaToSend,
        callback_url: PAYSTACK_CALLBACK_URL
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { authorization_url, access_code, reference } = response.data.data;
    console.log("Paystack init reference:", reference);

    return res.status(200).json({
      message: "Payment initiated",
      authorization_url,
      access_code,
      reference,
    });
  } catch (error) {
    console.error("Paystack Error:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Payment initiation failed",
      details: error.response?.data || error.message,
    });
  }
};


exports.verifyPayment = async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paymentData = response.data.data;
    console.log("Paystack verify result:", paymentData);

    if (paymentData.status !== "success") {
      return res.status(400).json({ message: "Payment not successful", data: paymentData });
    }

    // Check metadata for AFA registration marker
    const meta = paymentData.metadata || {};
    const isAfa = meta.type === "afa_registration" || meta.isAFA === true;

    if (isAfa) {
      // Create AFA registration instead of an order
      // Map fields from metadata as needed; adjust to match your AFARegistration schema
      const afaPayload = {
        fullname: meta.fullname || meta.name || meta.full_name || "",
        idNumber: meta.idnumber || meta.idNumber || meta.id || "",
        dob: meta.dob || meta.dateOfBirth || meta.date_of_birth || "",
        phone: meta.phone || paymentData.customer?.phone || "",
        location: meta.location || "",
        region: meta.region || "",
        occupation: meta.occupation || "",
        paymentReference: paymentData.reference,
        amountPaid: (paymentData.amount / 100), // store as GHS
        verifiedAt: new Date(),
        rawPaymentData: paymentData // optional: store raw paystack data for audit
      };

      // Create and save registration (adjust model name/fields to your schema)
      const newAfa = new AFARegistration(afaPayload);
      await newAfa.save();

      return res.status(200).json({
        message: "Payment verified and AFA registration created successfully",
        data: paymentData,
        registration: newAfa,
      });
    } else {
      // Default: create a MTNOrder (existing flow)
      const newOrder = new MTNOrder({
        recipient: paymentData.metadata?.phone,
        quantity: paymentData.metadata?.quantity,
        network: paymentData.metadata?.operatorId,
        price: (paymentData.amount / 100).toString(),
        payment: paymentData.reference,
        status: "Pending",
        updated: new Date().toISOString(),
        email: paymentData.customer?.email,
        transactionId: paymentData.id?.toString()
      });

      await newOrder.save();

      return res.status(200).json({
        message: "Payment verified and order created successfully",
        data: paymentData,
        order: newOrder,
      });
    }
  } catch (error) {
    console.error("Verification error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Payment verification failed", details: error.response?.data || error.message });
  }
};
