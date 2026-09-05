const UssdSession = require("../models/UssdSession");
const Whitelist = require("../models/Whitelist");
const Package = require("../models/Package");

module.exports = {
  saveSession: async (payload) => {
    return await UssdSession.create(payload);
  },

  checkWhitelist: async (phone) => {
    return await Whitelist.findOne({ phone });
  },

  getSessionById: async (sessionId) => {
    return await UssdSession.findOne({ sessionId });
  },

  updateSteps: async (sessionId, step) => {
    return await UssdSession.updateOne({ sessionId }, { steps: step });
  },

  updateSession: async (sessionId, payload) => {
    return await UssdSession.updateOne({ sessionId }, payload);
  },

  getDataPlan0: async (network) => {
    return await Package.find({ status: 1, available: 1, network }).sort("price");
  },

  getVendorPak: async (per_page, page, network) => {
    const limit = per_page;
    const skip = (page - 1) * limit;

    const [data, count] = await Promise.all([
      Package.find({ status: 1, available: 1, network }).sort("price").skip(skip).limit(limit),
      Package.countDocuments({ status: 1, available: 1, network })
    ]);

    const total_pages = Math.ceil(count / limit);

    return {
      status: 1,
      code: "DP001",
      data: {
        data_packages: data,
        total_pages,
        total_records: count,
        items_per_page: limit,
        previous: page > 1 ? page - 1 : null,
        next: page < total_pages ? page + 1 : null,
        current_page: page
      }
    };
  }
};
