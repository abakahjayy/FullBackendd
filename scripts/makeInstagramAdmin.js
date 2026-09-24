// Give a user the 'admin' role so they can send app-update emails from
// /admin/updates in the Instagram clone.
//
//   node --env-file .env scripts/makeInstagramAdmin.js <username>
//
// Runs against whatever MONGO_URI is in .env - point it at the database the live
// site uses (Atlas) to make the admin there.
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
    const username = process.argv[2];
    if (!username) throw new Error('Usage: node --env-file .env scripts/makeInstagramAdmin.js <username>');
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const user = await User.findOneAndUpdate({ username }, { role: 'admin' }, { new: true });
    console.log(user ? `${user.username} is now an admin.` : `No user named ${username}.`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
