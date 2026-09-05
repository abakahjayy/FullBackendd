const mongoose = require('mongoose');
const { ObjectId } = require("mongodb");
const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const Post = require('../models/Posts');
const Chat = require('../models/ChatAi');
const UserChats = require('../models/UserChatAi');
const stringSimilarity = require("string-similarity");
const ImageKit = require("imagekit");
const imagekit = new ImageKit({
    urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
    publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});
//These are imagekit token parameters
// const result = imagekit.getAuthenticationParameters();
// console.log(result)


//test
// const SummaryTool = require("node-summary");

// const longPrompt = "Explain the impact of quantum computing on modern encryption techniques.";

// SummaryTool.summarize("", longPrompt, function(err, summary) {
//   if (err) return console.error(err);
//   const title = summary.split(".")[0]; // First sentence
//   console.log("Generated title:", title);
// });



//Backend with imagekit and clerk
exports.getUploadAuth = (req, res) => {
    const result = imagekit.getAuthenticationParameters();
    res.send(result);
};


exports.editMessageInChat = async (req, res) => {
    const { userId, chatId, messageIndex } = req.params;
    const { newText } = req.body;

    if (!userId || !chatId || messageIndex === undefined) {
        throw new BadRequestError("Missing required parameters");
    }

    if (!newText || newText.trim() === "") {
        throw new BadRequestError("New text cannot be empty");
    }

    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
        throw new NotFoundError(`No chat found with id: ${chatId}`);
    }

    const index = parseInt(messageIndex);

    if (isNaN(index) || index < 0 || index >= chat.history.length) {
        throw new BadRequestError("Invalid message index");
    }

    // Update the text of the message (only if it's a user or model message)
    if (!chat.history[index].parts || !chat.history[index].parts[0]) {
        throw new BadRequestError("Invalid message format");
    }

    chat.history[index].parts[0].text = newText.trim();
    await chat.save();

    res.status(StatusCodes.OK).json({
        message: "Message updated successfully",
        updatedMessage: chat.history[index],
        updatedChat: chat,
    });
};

exports.searchChatsByTitle = async (req, res) => {
    const userId = req.params.userId;
    const searchQuery = req.query.query;

    if (!userId || !searchQuery) {
        throw new BadRequestError('Please provide both userId and query');
    }

    const userChatsDoc = await UserChats.findOne({ userId });

    if (!userChatsDoc || !userChatsDoc.chats.length) {
        throw new NotFoundError('No chats found for this user');
    }

    // Filter chats based on 60% similarity
    const threshold = 0.3;
    const results = userChatsDoc.chats.filter((chat) => {
        const title = chat.title || '';
        const similarity = stringSimilarity.compareTwoStrings(title.toLowerCase(), searchQuery.toLowerCase());
        return similarity >= threshold;
    });

    res.status(StatusCodes.OK).json({
        message: `Chats similar to "${searchQuery}"`,
        data: results,
        total: results.length,
    });
};


exports.createChat = async (req, res) => {//This is used to create a new chat
    const userId = req.params.userId;
    if (!userId) {
        throw new BadRequestError('You must provide a user Id ')
    }
    let { text } = req.body;
    if (text == 'New Chat') {
        console.log('New Chat')
        text = '.'
    }
    if (!text) {
        throw new BadRequestError('You must provide some text')
    }
    const newChat = new Chat({
        userId: userId,
        history: [{ role: "user", parts: [{ text }] }],
    });

    const savedChat = await newChat.save();
    // console.log(savedChat._id)

    let userChats = await UserChats.find({ userId });

    if (!userChats.length) {
        userChats = new UserChats({
            userId: userId,
            chats: [{ chatId: savedChat._id, title: text.substring(0, 40) }],
        });
        await userChats.save();
    } else {
        await UserChats.updateOne(
            { userId: userId },
            {
                $push: {
                    chats: { chatId: savedChat._id, title: text.substring(0, 40) },
                },
            }
        );
    }

    res.status(StatusCodes.CREATED).json({ message: 'Chat created successfully', userChats, savedChat });
};

exports.getUserChats = async (req, res) => {//This will send all userchats
    const userId = req.params.userId;
    if (!userId) {
        throw new BadRequestError('You must provide a user Id ')
    }
    const userChats = await UserChats.find({ userId });
    if (!userChats) {
        throw new NotFoundError(`No user chats found with id: ${userId}`)
    }
    res.status(StatusCodes.OK).json({ message: 'User Chats Found', data: userChats });
};

exports.getChatById = async (req, res) => {//This will access an individual chat with chatId and userId
    const userId = req.params.userId;
    const chatId = req.params.chatId
    if (!userId || !chatId) {
        throw new BadRequestError('Please provide both userId and chatId');
    }
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
        throw new BadRequestError(`No chat with chatId: ${chatId}`)
    }
    res.status(StatusCodes.OK).json({ message: 'Chat found successfully', data: chat, nbHits: chat.length });
};

exports.deleteChat = async (req, res) => {//This will access an individual chat with chatId and userId
    const userId = req.params.userId;
    const chatId = req.params.chatId
    if (!userId || !chatId) {
        throw new BadRequestError('Please provide both userId and chatId');
    }
    const deletedChat = await Chat.findOneAndDelete({ _id: chatId, userId });
    if (!deletedChat) {
        throw new NotFoundError(`No chat with chatId: ${chatId}`);
    }

    // Remove from UserChats as well
    await UserChats.updateOne(
        { userId },
        { $pull: { chats: { chatId } } }
    );

    res.status(StatusCodes.OK).json({ message: 'Chat deleted successfully', deletedChat });

};

exports.deleteMessage = async (req, res) => {//This will access an individual chat with chatId and userId
    const userId = req.params.userId;
    const chatId = req.params.chatId
    const messageIndex = req.params.messageIndex
    if (!userId || !chatId) {
        throw new BadRequestError('Please provide both userId and chatId');
    }
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
        throw new NotFoundError(`No chat found with id: ${chatId}`);
    }
    console.log({ messageIndex })
    if (messageIndex === undefined || isNaN(messageIndex) || messageIndex < 0 || messageIndex >= chat.history.length) {
        throw new BadRequestError('Invalid or missing messageIndex');
    }

    const removedMessage = chat.history.splice(messageIndex, 1)[0];
    await chat.save();

    res.status(StatusCodes.OK).json({
        message: 'Message deleted successfully',
        removedMessage,
        updatedChat: chat
    });

};


exports.updateChat = async (req, res) => {//This is used to update a chat with a message
    const userId = req.params.userId;
    const chatId = req.params.chatId
    if (!userId) {
        throw new BadRequestError('You must provide a user Id ')
    }
    if (!chatId) {
        throw new BadRequestError('You must provide a chat Id ')
    }
    const { question, answer, img } = req.body;
    // const userchat = await UserChats.find({userId});
    // console.log('userchat:',userchat)
    console.log('Body:', req.body)
    // if (!question) {
    //     throw new BadRequestError('You must provide a question from user ')
    // }
    const newItems = [
        ...(question
            ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
            : []),
        { role: "model", parts: [{ text: answer }] },
    ];

    const updatedChat = await Chat.updateOne(//This returns statistics
        { _id: chatId, userId },
        { $push: { history: { $each: newItems } } }
    );
    const chatUpdated = await Chat.findOne({ _id: chatId, userId });//This returns the data itself
    if (!chatUpdated) {
        throw new NotFoundError(`No chat found with id: ${chatId}`)
    }


    // 4. Update the title in UserChats if it's currently "."
    const userChat = await UserChats.findOne({ userId });

    if (userChat) {
        const chatIndex = userChat.chats.findIndex(
            (chat) => chat.chatId.toString() === chatId
        );

        if (chatIndex !== -1 && userChat.chats[chatIndex].title === ".") {
            // Use first 6 words of question as title (fallback to "New Chat")
            const newTitle =
                (question?.trim().split(" ").slice(0, 6).join(" ") || "New Chat").trim();

            userChat.chats[chatIndex].title = newTitle;
            await userChat.save();
            console.log(`✅ Chat title updated to: "${newTitle}"`);
        }
    }

    // console.log(userchat)
    res.status(StatusCodes.OK).json({ message: 'Updated Chat Successfully', stats: updatedChat, data: chatUpdated });
};



exports.postImage = async (req, res) => {
    // const { caption, comments } = req.body;
    const { userId } = req.params;
    const { chatId } = req.params;
    const { text, response } = req.body
    console.log('\x1b[32m%s\x1b[0m', 'caption:')

    if (!userId || !chatId) {
        throw new BadRequestError('Please provide both userId and chatId');
    }
    console.log('File:', req.file.id)
    if (!req.file) {
        throw new BadRequestError('Please No file has been Detected')
    }
    const chat = await Chat.findOne({ userId, _id: chatId })
    if (!chat) {
        // createChat()
        throw new NotFoundError(`No Chat found with id:${chatId}`)
    }
    chat.history.push({
        role: "user",
        img: req.file.id,
        parts: [{ text }]
    });

    const aiResponse = {
        role: "model",
        parts: [{ text: response }],
    };

    chat.history.push(aiResponse);
    await chat.save();



    // postId: req.file.id, // Save GridFS file ID

    // chat.history.push(req.file.id);
    console.log('\x1b[34m%s\x1b[0m', `User: ${userId} made a post`)
    console.log(req.file)
    // await chat.save();
    res.status(StatusCodes.CREATED).json({ message: 'You posted an image', imageId: req.file.id, chat });
};


exports.getImage = async (req, res) => {//This is used to get an image from the data base with ann ImageId
    const { id } = req.params;//ImageId
    console.log('\x1b[36m%s\x1b[0m', 'User Wants to get Image')

    if (!id || id === 'null' || id === 'undefined') {
        throw new BadRequestError('Please provide the image id')
    }

    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    const file = await gfs.find({ _id: new ObjectId(id) }).toArray();

    if (!file || file.length === 0) {
        throw new NotFoundError(`No Image found with id: ${id}`)
    }

    res.set("Content-Type", file[0].contentType);
    res.set("Content-Disposition", `attachment; filename=${file[0].filename}`);

    await gfs.openDownloadStream(new ObjectId(id)).pipe(res);
};

exports.deleteImage = async (req, res) => {
    const { fileId } = req.params;
    const { chatId } = req.params;
    if (!fileId || !chatId) {
        throw new BadRequestError('Please provide both fileId and chatId');
    }
    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    const file = await gfs.find({ _id: new ObjectId(fileId) }).toArray();

    if (file.length === 0) {
        throw new NotFoundError(`No Image found with id: ${fileId}`)
    }
    await gfs.delete(new ObjectId(fileId));
    const chat = await Chat.findOne({ _id: chatId });

    if (!chat) {
        throw new NotFoundError(`No chat found with id: ${chatId}`)
    }
    chat.history = chat.history.filter(
        (msg) => !(msg.img && msg.img.toString() === fileId)
    );

    await chat.save();

    res.status(StatusCodes.OK).json({
        message: 'Image and references deleted successfully',
        updatedChat: chat
    });
};