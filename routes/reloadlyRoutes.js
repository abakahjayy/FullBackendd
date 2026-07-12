// routes/reloadlyRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getOperators, purchaseAirtime, getAccessToken } = require('../controllers/reloadlyController');

router.get('/operators', getOperators);
router.post('/purchase', purchaseAirtime);
router.get('/operators/:id/bundles', async (req, res) => {
    const operatorId = req.params.id;
    const token = await getAccessToken();

    const { data } = await axios.get(`https://topups-sandbox.reloadly.com/operators/${operatorId}/packages`
        , {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/com.reloadly.topups-v1+json',
            },
        });

    res.status(200).json(data);
});


module.exports = router;
