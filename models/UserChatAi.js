const mongoose = require("mongoose");
const userChatsSchema = new mongoose.Schema(
  {
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please Provide the User Id']
    },
    chats: [
      {
        chatId: {
          type: mongoose.Types.ObjectId,
          ref: 'Chat',
          required: [true, 'Please Provide the Chat Id']
        },
        title: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default:Date.now()
        },
        created:{
          type:Number,
          default:Date.now()
        },
      },
    ],
    created:{
      type:Number,
      default:Date.now()
    },
  },
  { timestamps: true }
);

const UserChats = mongoose.model("UserChats", userChatsSchema);
module.exports = UserChats;

// export default mongoose.models.UserChats ||
//   mongoose.model("UserChats", userChatsSchema);


exports.updateChat = async (req, res) => {
	const { userId, chatId } = req.params;

	if (!userId) throw new BadRequestError("You must provide a user Id");
	if (!chatId) throw new BadRequestError("You must provide a chat Id");

	const { question, answer, img } = req.body;

	// 1. Format new history items
	const newItems = [
		...(question
			? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
			: []),
		{ role: "model", parts: [{ text: answer }] },
	];

	// 2. Push new messages to chat history
	const updatedChat = await Chat.updateOne(
		{ _id: chatId, userId },
		{ $push: { history: { $each: newItems } } }
	);

	// 3. Return the updated chat
	const chatUpdated = await Chat.findOne({ _id: chatId, userId });
	if (!chatUpdated) throw new NotFoundError(`No chat found with id: ${chatId}`);

	
	res.status(StatusCodes.OK).json({
		message: "✅ Chat updated successfully",
		stats: updatedChat,
		data: chatUpdated,
	});
};
