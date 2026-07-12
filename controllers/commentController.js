
const Comment = require('../models/Comments');
const Post = require('../models/Posts');
const User = require('../models/User');
const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')
const {StatusCodes} = require('http-status-codes')

exports.addComment = async (req, res) => {
  const { postId } = req.params;
  const { text, userId } = req.body;
  console.log(req.body)
  console.log(postId)

  if(!postId||postId==='undefined'){
    throw new  BadRequestError('Please Provide the postId')
  }

  if(!text){
    throw new  BadRequestError('Please Provide the Text')
  }
  if(!userId){
    throw new  BadRequestError('Please Provide the userId')
  }
  const post = await Post.findOne({_id:postId});
  
  if(!post){
    throw new NotFoundError(`No post Found with id: ${postId}`)
  }
  
  const user = await User.findOne({_id:userId})

  if(!user){
    throw new NotFoundError(`No user found with id: ${userId}`)
  }
  
    const newComment = new Comment({
      text,
      user: userId,
      post: postId,
      created: new Date(),
    });

    await newComment.save();

    post.comments.push(newComment._id);
    await post.save();



    res.status(StatusCodes.CREATED).json({newComment,post,user});
  
};


exports.deleteComment = async (req, res) => {
    const { postId } = req.params;
    const { commentId } = req.query;


    if(!postId){
      throw new  BadRequestError('Please Provide the postId')
    }
  
    if(!commentId){
      throw new  BadRequestError('Please Provide the commentId')
    }

    const post = await Post.findOne({postId});
    if(!post){
      throw new NotFoundError(`No post Found with id: ${postId}`)
    }

    const commentDel =await Comment.findOneAndDelete({_id:commentId});

    if(!commentDel){
      throw new NotFoundError(`No comment found with id: ${commentId}`)
    }



    post.comments.forEach((comment,index)=>{
        const newCommentId = JSON.stringify(comment._id).split('"')[1]
          if (newCommentId === commentDel) {
              console.log(comment, index)
              post.comments.splice(index, 1);
          }
    });
    await post.save();
    res.status(StatusCodes.OK).json({message:'Comment deleted successfully',post});
  
};


exports.getPostComments = async (req, res) => {
  const { postId } = req.params;

    const post = await Post.findOne({postId});
    if(!post){
      throw new NotFoundError(`No post Found with id: ${postId}`)
    }
    const comments =await Comment.find({post:postId});

    if(!comments){
      throw new NotFoundError(`No comments found with id: ${postId}`)
    }

    res.status(StatusCodes.OK).json({message:'Comments found successfully',comments});
  
};

