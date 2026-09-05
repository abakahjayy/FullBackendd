require('dotenv').config();
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User.js');
const archiver = require("archiver");
const { Transform } = require("stream");
const { ObjectId } = require("mongodb");
const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')



let bucket;
(() => {
    mongoose.connection.on("connected", () => {
        bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "uploads",
        });
        console.log('\x1b[35m%s\x1b[0m','GridFS Connected for testing');
    });
})(); 


// Route handler for uploading profile picture
const uploadProfilePic = async (req, res) => {
    console.log('Starting update process');

    // Check if a file is uploaded
    if (!req.file) {
        console.warn('Cannot Find File');
        throw new BadRequestError('No File Detected');
    }
    console.log('File has been found');

    // Generate URL for uploaded image (GridFS URL format)
    const profilePicUrl = `/uploads/${req.file.filename}`;

    // Assuming the user's ID is available in req.user (you may want to validate and check the user's authentication status)
    const userId = req.user.userId;  // Example: req.user.userId from authentication middleware

    // Update the user's profile picture URL in the database
    const user = await User.findByIdAndUpdate(userId, { profile_picture: null ,profile_picture_id:req.file.id }, { new: true });
    // await user.save();
    // Handle case where user is not found
    if (!user) {
        throw new NotFoundError('User Not Found')
    }
    // Return the new profile picture URL as a response
    res.status(StatusCodes.OK).json({ success: true, profile_picture: user.profile_picture, fileId: req.file.id });
};


// Upload a single file
const uploadSingleFile = async (req, res) => {
    if (!req.file) {
        console.warn('Cannot Find File');
        throw new BadRequestError('No File Detected');
    }
    res.status(StatusCodes.CREATED).json({ text: "File uploaded successfully!", file: req.file });
};


// Upload multiple files
const uploadMultipleFiles = async (req, res) => {
    if (!req.file) {
        console.warn('Cannot Find File');
        throw new BadRequestError('No File Detected');
    }
    res.status(StatusCodes.CREATED).json({ text: "Files uploaded successfully!", files: req.files });
};

// Download a file by ID
const downloadFileById = async (req, res) => {
        const { fileId } = req.params;
        console.log('\x1b[36m%s\x1b[0m', `Downloading file:${fileId}`)
        if(!fileId) {
            throw new BadRequestError('Please provide a fileId')
        }
        const file = await bucket.find({ _id: new ObjectId(fileId) }).toArray();

        if (file.length === 0) return res.status(404).json({ error: { text: "File not found" } });

        res.set("Content-Type", file[0].contentType);
        res.set("Content-Disposition", `attachment; filename=${file[0].filename}`);

        bucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
};

// Download files as ZIP
const downloadFilesAsZip = async (req, res) => {
        const files = await bucket.find().toArray();
        if (files.length === 0) {
            return res.status(404).json({ error: { text: "No files found" } });
        }

        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", `attachment; filename=files.zip`);

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(res);

        files.forEach((file) => {
            const stream = bucket.openDownloadStream(file._id);
            archive.append(stream, { name: file.filename });
        });

        archive.finalize();
};

// Download files as Base64
const downloadFilesAsBase64 = async (req, res) => {
        const files = await bucket.find().toArray();
        const filesData = await Promise.all(
            files.map(
                (file) =>
                    new Promise((resolve) => {
                        const chunks = [];
                        bucket.openDownloadStream(file._id).pipe(
                            new Transform({
                                transform(chunk, encoding, done) {
                                    chunks.push(chunk);
                                    done();
                                },
                                flush(done) {
                                    const base64 = Buffer.concat(chunks).toString("base64");
                                    resolve(base64);
                                    done();
                                },
                            })
                        );
                    })
            )
        );
        res.status(StatusCodes.OK).json(filesData);
    
};

// Rename a file
const renameFile = async (req, res) => {
        const { fileId } = req.params;
        const { filename } = req.body;

        await bucket.rename(new ObjectId(fileId), filename);
        res.status(200).json({ text: "File renamed successfully!" });
};

// Delete a file
const deleteFile = async (req, res) => {
    
        const { fileId } = req.params;
        await bucket.delete(new ObjectId(fileId));
        res.status(StatusCodes.OK).json({ text: "File deleted successfully!" });
};


module.exports = {
    uploadProfilePic,
    uploadSingleFile,
    uploadMultipleFiles,
    downloadFileById,
    downloadFilesAsZip,
    downloadFilesAsBase64,
    renameFile,
    deleteFile,
};