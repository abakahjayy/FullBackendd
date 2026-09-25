const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { postUpload } = require('../utils/storageMulter');
const { BadRequestError } = require('../errors');
const { uploadImage, uploadFile } = require('../controllers/ghgpt');

// GH-GPT uploads (multipart), mounted in app.js before express-fileupload,
// which would otherwise consume the body. The JSON routes are in routes/ghgpt.js.
const router = express.Router();

const MAX_DOC_BYTES = 20 * 1024 * 1024;

// Documents are held in memory so their text can be extracted before storing.
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOC_BYTES } }).single('file');
const acceptDocument = (req, res, next) => docUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
        return next(new BadRequestError(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 20 MB)' : err.message));
    }
    next(err);
});

router.post(
    '/uploads',
    authMiddleware,
    postUpload('file', { accept: /^image\//, maxBytes: 10 * 1024 * 1024, kind: 'image' }),
    uploadImage
);

router.post('/files', authMiddleware, acceptDocument, uploadFile);

module.exports = router;
