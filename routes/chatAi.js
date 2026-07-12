const express = require('express');
const { ClerkExpressRequireAuth }= require("@clerk/clerk-sdk-node");
const {
    deleteChat,
    getUploadAuth,
    createChat,
    getUserChats,
    getChatById,
    updateChat,
    deleteMessage,
    searchChatsByTitle,
    editMessageInChat
} = require('../controllers/chatAi');
const router = express.Router();

router.post("/chats/:userId",createChat);//
router.get("/userchats/:userId", getUserChats);//
router.get("/userchats/:userId/search-by-similarity", searchChatsByTitle);
router.get("/chats/:userId/:chatId", getChatById);//
router.patch("/chats/:userId/:chatId", updateChat);//
router.delete('/chats/:userId/:chatId', deleteChat);//
router.delete('/chats/:userId/:chatId/:messageIndex', deleteMessage);
router.patch('/chats/:userId/:chatId/:messageIndex', editMessageInChat);


//This is for imagekit and clerk backend
// router.get("/upload", getUploadAuth);
// router.post("/chats", ClerkExpressRequireAuth(), createChat);
// router.get("/userchats", ClerkExpressRequireAuth(), getUserChats);
// router.get("/chats/:id", ClerkExpressRequireAuth(), getChatById);
// router.put("/chats/:id", ClerkExpressRequireAuth(), updateChat);
module.exports = router;