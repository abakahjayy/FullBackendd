// controllers/reloadlyController.js
const axios = require('axios');

const RELOADLY_CLIENT_ID = process.env.RELOADLY_CLIENT_ID;
const RELOADLY_CLIENT_SECRET = process.env.RELOADLY_CLIENT_SECRET;

const AUTH_URL = 'https://auth.reloadly.com/oauth/token';
const API_BASE = 'https://topups-sandbox.reloadly.com'; // use production base if needed

const getAccessToken = async () => {
    const { data } = await axios.post(AUTH_URL, {
        client_id: RELOADLY_CLIENT_ID,
        client_secret: RELOADLY_CLIENT_SECRET,
        grant_type: 'client_credentials',
        audience: 'https://topups-sandbox.reloadly.com', // ✅ Use sandbox audience
    }, {
        headers: { 'Content-Type': 'application/json' },
    });

    return data.access_token;
};

const getOperators = async (req, res) => {

    const token = await getAccessToken();

    const { data } = await axios.get(`${API_BASE}/operators/countries/gh`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/com.reloadly.topups-v1+json', // REQUIRED
        },
    });

    res.status(200).json(data);
};

const purchaseAirtime = async (req, res) => {
    const { operatorId, amount, recipientPhone } = req.body;

    const token = await getAccessToken();

    const payload = {
        operatorId,            // e.g., 643 for MTN Data
        amount,                // e.g., 5.00
        useLocalAmount: true,
        recipientPhone: {
            countryCode: 'GH',
            number: recipientPhone,  // e.g., '0548209019'
        },
        senderPhone: {
            countryCode: 'GH',
            number: recipientPhone,
        }
    };

    const { data } = await axios.post(`${API_BASE}/topups`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/com.reloadly.topups-v1+json',
        },
    });

    res.status(200).json({
        message: 'Top-up successful',
        data,
    });


};


module.exports = {
    getOperators,
    purchaseAirtime,
    getAccessToken
};
