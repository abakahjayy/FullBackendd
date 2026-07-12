const express = require('express');
const { ClerkExpressRequireAuth }= require("@clerk/clerk-sdk-node");
const {
    postImage,
    getImage ,
    deleteImage,
    
} = require('../controllers/chatAi');
const {upload} = require('../utils/storageMulter');
const router = express.Router();

router.route('/upload/:userId/:chatId').post( upload().single('file'), postImage);//
router.get('/image/:id', getImage);//
router.delete('/chats/image/:chatId/:fileId', deleteImage);//


module.exports = router;