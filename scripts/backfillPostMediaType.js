// Sets Posts.mediaType from the real GridFS contentType for posts saved before
// createPost recorded it (they all defaulted to 'image', videos included).
// Safe to re-run: only posts whose stored value is wrong are updated.
//
//   node --env-file .env scripts/backfillPostMediaType.js
const mongoose = require('mongoose');
const Post = require('../models/Posts');

(async () => {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const files = mongoose.connection.db.collection('uploads.files');

    let fixed = 0;
    for (const post of await Post.find({}, { postId: 1, mediaType: 1 })) {
        const file = await files.findOne({ _id: post.postId }, { projection: { contentType: 1 } });
        if (!file) continue;
        const actual = /^video\//.test(file.contentType || '') ? 'video' : 'image';
        if (post.mediaType !== actual) {
            await Post.updateOne({ _id: post._id }, { $set: { mediaType: actual } });
            console.log(`post ${post._id}: ${post.mediaType} -> ${actual}`);
            fixed++;
        }
    }
    console.log(`Done - ${fixed} post(s) updated.`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
