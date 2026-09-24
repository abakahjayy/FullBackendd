const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket } = require("mongodb");
const crypto = require("crypto");
const path = require("path");
const { BadRequestError } = require("../errors");

// Create storage engine. `options` is passed straight to multer, so callers
// can add `limits` / `fileFilter` (see postUpload below).
function upload(options = {}) {
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

    // multer-gridfs-storage calls bucket.delete(id, cb), but package.json pins the
    // mongodb driver to v5, which ignores callbacks - so cb never fires and any
    // aborted upload (size limit, filter error) hangs the request forever and
    // leaves the partial file in GridFS. Use the promise API instead.
    storage._removeFile = (req, file, cb) => {
        new GridFSBucket(storage.db, { bucketName: file.bucketName })
            .delete(file.id)
            .then(() => cb(null), cb);
    };

    return multer({ storage, ...options });
}

// Posts accept images and videos only. Videos are capped because they live in
// the same MongoDB (GridFS) as everything else - Atlas free tier is 512 MB total.
const MAX_POST_FILE_BYTES = 50 * 1024 * 1024;

function postUpload(field) {
    const single = upload({
        limits: { fileSize: MAX_POST_FILE_BYTES },
        fileFilter: (req, file, cb) => {
            if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
            cb(new BadRequestError('Only image or video files can be posted'));
        },
    }).single(field);

    // Turn multer's own errors (e.g. LIMIT_FILE_SIZE) into 400s instead of 500s.
    return (req, res, next) => single(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? `File is too large (max ${MAX_POST_FILE_BYTES / 1024 / 1024} MB)`
                : err.message;
            return next(new BadRequestError(message));
        }
        next(err);
    });
}

module.exports = { upload, postUpload };
