const SeedBridgeUser = require('../models/SeedBridgeUser.js');
const Produce = require('../models/SeedBridgeProduce.js');
const Order = require('../models/SeedBridgeOrder.js');

// USSD gateways (Africa's Talking included) are stateless between requests:
// every request resends the FULL sequence of what the user has typed so far,
// separated by '*'. Your server has to re-derive "where am I in the menu"
// from that string each time - there's no session object to read from.
//
// Africa's Talking POSTs these fields as application/x-www-form-urlencoded:
//   sessionId, serviceCode, phoneNumber, text
//
// Response format: prefix with "CON " to keep the session open (show another
// menu / ask for more input), or "END " to close it (final message).

const normalizePhone = (phone) => {
    // Africa's Talking sends phone numbers as +233XXXXXXXXX. Adjust this if
    // your SeedBridgeUser.phone field is stored in local format
    // (0XXXXXXXXX) instead.
    if (phone.startsWith('+233')) return '0' + phone.slice(4);
    return phone;
};

const handleUssd = async (req, res) => {
    const { phoneNumber, text } = req.body;
    const steps = text ? text.split('*') : [];
    const phone = normalizePhone(phoneNumber);

    let response;

    try {
        response = await routeMenu(steps, phone);
    } catch (err) {
        response = `END Something went wrong. Please try again later.`;
    }

    res.set('Content-Type', 'text/plain');
    return res.send(response);
};

const routeMenu = async (steps, phone) => {
    // steps[0] is empty string on the very first request (text === "").
    if (steps.length === 0 || steps[0] === '') {
        return mainMenu();
    }

    const user = await SeedBridgeUser.findOne({ phone });
    if (!user) {
        return `END No SeedBridge account found for this number. Please register at the SeedBridge app first.`;
    }

    switch (steps[0]) {
        case '1':
            return handleMarketPrices(steps, user);
        case '2':
            return handleMyOrders(steps, user);
        case '3':
            return handleMyListings(steps, user);
        default:
            return `END Invalid option.`;
    }
};

const mainMenu = () => {
    return (
        `CON Welcome to SeedBridge\n` +
        `1. Market Prices\n` +
        `2. My Orders\n` +
        `3. My Listings (Farmers)`
    );
};

// -- Option 1: Market Prices ------------------------------------------------
const handleMarketPrices = async (steps) => {
    // steps: ["1"]  ->  show crop list
    // steps: ["1", "<crop>"]  ->  show price for that crop
    if (steps.length === 1) {
        return (
            `CON Select a crop:\n` +
            `1. Tomatoes\n` +
            `2. Garden Eggs\n` +
            `3. Okra\n` +
            `4. Peppers\n` +
            `5. Leafy Greens`
        );
    }

    const cropMap = {
        '1': 'tomatoes',
        '2': 'garden_eggs',
        '3': 'okra',
        '4': 'peppers',
        '5': 'leafy_greens',
    };
    const crop = cropMap[steps[1]];
    if (!crop) {
        return `END Invalid crop selection.`;
    }

    const listings = await Produce.find({ crop, status: { $in: ['available', 'partially_sold'] } });
    if (listings.length === 0) {
        return `END No current listings for this crop.`;
    }

    const prices = listings.map((p) => p.pricePerKg);
    const avg = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
    const min = Math.min(...prices).toFixed(2);
    const max = Math.max(...prices).toFixed(2);

    return (
        `END ${crop.replace('_', ' ')} prices (GHS/kg):\n` +
        `Average: ${avg}\n` +
        `Range: ${min} - ${max}\n` +
        `${listings.length} active listing(s)`
    );
};

// -- Option 2: My Orders (buyer or farmer) ----------------------------------
const handleMyOrders = async (steps, user) => {
    // steps: ["2"]  ->  list recent orders
    // steps: ["2", "<index>"]  ->  show detail for that order
    const filter =
        user.role === 'farmer' ? { farmerId: user._id } : { buyerId: user._id };
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(5);

    if (orders.length === 0) {
        return `END You have no orders yet.`;
    }

    if (steps.length === 1) {
        const lines = orders.map(
            (o, i) => `${i + 1}. ${o.crop} - ${o.quantityKg}kg (${o.status})`
        );
        return `CON Your recent orders:\n${lines.join('\n')}`;
    }

    const index = Number(steps[1]) - 1;
    const order = orders[index];
    if (!order) {
        return `END Invalid selection.`;
    }

    return (
        `END Order detail:\n` +
        `Crop: ${order.crop}\n` +
        `Quantity: ${order.quantityKg}kg\n` +
        `Total: GHS ${order.totalAmount.toFixed(2)}\n` +
        `Status: ${order.status}\n` +
        `Payment: ${order.paymentStatus}`
    );
};

// -- Option 3: My Listings (farmers only) -----------------------------------
const handleMyListings = async (steps, user) => {
    if (user.role !== 'farmer') {
        return `END This option is only available to farmers.`;
    }

    const listings = await Produce.find({ farmerId: user._id }).sort({ createdAt: -1 }).limit(5);

    if (listings.length === 0) {
        return `END You have no active listings. Add one from the SeedBridge app.`;
    }

    if (steps.length === 1) {
        const lines = listings.map(
            (p, i) => `${i + 1}. ${p.crop} - ${p.availableKg}kg @ GHS${p.pricePerKg}/kg`
        );
        return `CON Your listings:\n${lines.join('\n')}`;
    }

    const index = Number(steps[1]) - 1;
    const listing = listings[index];
    if (!listing) {
        return `END Invalid selection.`;
    }

    return (
        `END Listing detail:\n` +
        `Crop: ${listing.crop}\n` +
        `Available: ${listing.availableKg}kg\n` +
        `Price: GHS ${listing.pricePerKg}/kg\n` +
        `Status: ${listing.status}`
    );
};

module.exports = { handleUssd };
