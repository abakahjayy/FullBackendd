const mongoose = require("mongoose");

const WhitelistSchema = new mongoose.Schema({
  phone: String
}); 

module.exports = mongoose.model("Whitelist", WhitelistSchema);
