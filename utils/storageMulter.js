const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const path = require("path");

// Create storage engine
function upload() {
    const mongodbUrl = process.env.MONGO_URI;
    const storage = new GridFsStorage({
        url: mongodbUrl,
        file: (req, file) => {
            return new Promise((resolve, reject) => {
                crypto.randomBytes(16, (err, buf) => {
                    if (err) return reject(err);

                    const filename = `${buf.toString('hex')}${path.extname(file.originalname)}`;
                    const fileInfo = {
                        filename: filename,
                        bucketName: 'uploads', // Ensure this matches the bucket name in GridFS
                    };
                    resolve(fileInfo);
                });
            });
        },
});


    return multer({ storage });
}

module.exports = { upload };
