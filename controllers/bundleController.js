// controllers/bundleController.js
const DataBundle = require('../models/DataBundle');

// GET all or by network
exports.getBundles = async (req, res) => {
    const { network } = req.query;

    const filter = network ? { network: network.toLowerCase() } : {};
    const bundles = await DataBundle.find(filter);
    res.json(bundles);
};

// POST: Add new bundle
exports.createBundle = async (req, res) => {
    const { network, size, price } = req.body;
    const bundle = await DataBundle.create({ network, size, price });
    res.status(201).json(bundle);
};

// PUT: Update bundle by ID
exports.updateBundle = async (req, res) => {
    const { id } = req.params;
    const bundle = await DataBundle.findByIdAndUpdate(id, req.body, { new: true });
    if (!bundle) return res.status(404).json({ message: 'Bundle not found' });
    res.json(bundle);
};

// DELETE: Delete by ID
exports.deleteBundle = async (req, res) => {
    const { id } = req.params;
    const result = await DataBundle.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: 'Bundle not found' });
    res.json({ message: 'Deleted successfully' });
};
