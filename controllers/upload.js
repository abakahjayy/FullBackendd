const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const {UnauthenticatedError} = require('../errors');
const { StatusCodes } = require('http-status-codes');

// Set up Multer storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './public/uploads';
        if (!fs.existsSync(uploadDir)) {
            console.warn('Uploads folder does not exist');
            fs.mkdirSync(uploadDir);  // Creates the directory if it doesn't exist
        }
        cb(null, uploadDir);  // Set the destination folder for file uploads
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname);  // Get the file extension
        cb(null, `profile-${Date.now()}-${fileExtension}`);  // Create a unique filename based on the current timestamp
    }
});

// Multer instance for handling file upload
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif','image/jpg'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            console.warn(`You cannot Upload a file with ${file.mimetype}`);
            return cb(new UnauthenticatedError('Only images are allowed!'), false);  // Reject files that aren't images
        }
        // req.file = file;
        cb(null, true);
    }
});

// Profile picture upload handler
const uploadProfilePic = async (req, res) => {
    // console.log(req.file)
    console.log('Starting update process');
    if (!req.file) {
        console.warn('Cannot Find File')
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: 'No file uploaded.' });
    }
    console.log('File has been found');
    const profilePicUrl = `../uploads/${req.file.filename}`;  // Generate URL for uploaded image

    try {
        const userId = req.user.userId; // Use the authenticated user's ID from req.user
        // Update the user's profile picture URL in the database
        const user = await User.findByIdAndUpdate(userId, { profile_picture: profilePicUrl }, { new: true });
        // console.log(user)
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ success: false, error: 'User not found.' });
        }

        res.status(StatusCodes.OK).json({ success: true, profile_picture: user.profile_picture });  // Respond with the new profile picture URL
    } catch (err) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Failed to update profile picture.' });
    }
};

module.exports = {
    upload,
    uploadProfilePic
};
