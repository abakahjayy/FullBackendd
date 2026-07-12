const UssdSession = require("../models/UssdSession");
const Package = require("../models/Package");
const { initiateStep, selection } = require("../utils/utils");

exports.handleUSSD = async (req, res) => {
    const { sessionID, userID, msisdn, newSession, userData, network } = req.body;
    const formatted = msisdn.replace(/^233/, '0');
    let steps = {};
    let session = null;

    if (newSession) {
        steps = initiateStep();
        await UssdSession.create({
            sessionId: sessionID,
            userId: userID,
            msisdn,
            network,
            userData,
            steps,
        });
        return res.json({
            message: "Welcome to BestData\n1. Internet Data\n\nCall or WhatsApp 0201499096",
            continueSession: true,
        });
    }

    session = await UssdSession.findOne({ sessionId: sessionID });
    if (!session) return res.json({ message: "Session not found", continueSession: false });

    steps = session.steps;

    // 1. Menu: Select Network
    if (steps.menu === 1 && steps.menu_network_option === 1) {
        if (userData === "1") {
            steps.menu = 0;
            steps.menu_network_option = 0;
            steps.menu_package_option = 1;
            await session.updateOne({ steps });
            return res.json({
                message: "Select Network\n1. MTN \n2. AT\n3. Telecel",
                continueSession: true,
            });
        }
        return res.json({ message: "Wrong Input", continueSession: false });
    }

    // 2. Menu: Select Package
    if (steps.menu_package_option === 1) {
        const options = ["1", "2", "3"];
        const selectedNetwork = steps.selected_network || selection(userData);

        if (!selectedNetwork) {
            return res.json({ message: "Wrong Input", continueSession: false });
        }

        steps.selected_network = selectedNetwork;

        const packages = await Package.find({ status: 1, available: 1, network: selectedNetwork }).sort({ price: 1 });

        if (!packages.length) {
            return res.json({ message: `Data Package\nNo package available`, continueSession: false });
        }

        let message = `Data Package for ${selectedNetwork}\n`;
        packages.forEach((pkg, idx) => {
            message += `${idx + 1}. ${pkg.bundle} - GHS ${pkg.price}\n`;
        });
        message += "\nEnter package number or N for next";

        await session.updateOne({ steps, data: { packages } });
        return res.json({ message, continueSession: true });
    }

    // 3. Menu: Enter Recipient
    if (steps.menu_recipient === 1) {
        const clean = userData.replace(/\D/g, '');
        const number = clean.length === 9 ? '0' + clean : clean;

        if (number.length !== 10) {
            return res.json({ message: "Invalid number format. Enter a 10-digit number starting with 0", continueSession: false });
        }

        steps.recipient_num = number;
        steps.menu_recipient = 0;
        steps.menu_confirm = 1;

        await session.updateOne({ steps });
        const chosen = session.data?.packages[session.data.choice - 1];

        return res.json({
            message: `Confirm purchase of ${chosen.bundle} for GHS ${chosen.price}\nBeneficiary: ${number}\n\nPress 1 to confirm payment`,
            continueSession: true,
        });
    }

    // 4. Menu: Confirm
    if (steps.menu_confirm === 1) {
        if (userData === "1") {
            return res.json({
                message: "Transaction initiated. Please confirm Mobile Money payment prompt. Thank you.",
                continueSession: false,
            });
        }
        return res.json({ message: "Wrong Input", continueSession: false });
    }

    return res.json({ message: "Session ended.", continueSession: false });
};
