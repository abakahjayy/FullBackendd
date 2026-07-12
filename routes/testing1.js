const express = require('express');
const router = express.Router();
// const {StatusCodes}= require('http-status-codes');

const {uploadProfilePic} = require('../controllers/testing1.js');
const {upload}= require('../utils/storageMulter.js')
const authMiddleware = require('../middleware/auth.js');



const {
    uploadSingleFile,
    uploadMultipleFiles,
    downloadFileById,
    downloadFilesAsZip,
    downloadFilesAsBase64,
    renameFile,
    deleteFile,
} = require("../controllers/testing1.js");

// Upload File to my customized Dashboard
router.route('/upload-profile-pic').patch(authMiddleware ,upload().single('profile_pictures'),uploadProfilePic )


// Upload routes
router.post("/upload/single", upload().single("file"), uploadSingleFile);
router.post("/upload/multiple", upload().array("files"), uploadMultipleFiles);

// Download routes
router.get("/download/:fileId", downloadFileById);
router.get("/download/zip", downloadFilesAsZip);
router.get("/download/base64", downloadFilesAsBase64);

// File operations
router.put("/rename/:fileId", renameFile);
router.delete("/delete/:fileId", deleteFile);



module.exports=router;