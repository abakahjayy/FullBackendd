const mongoose = require('mongoose');
const Post = require('../models/Posts');
const { ObjectId } = require("mongodb");
const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const Comment = require('../models/Comments');

exports.createPost = async (req, res) => {
  const { caption, comments } = req.body;
  const {userId} = req.query;
  console.log('\x1b[32m%s\x1b[0m','caption:',caption)


    if(!userId) {
      throw new BadRequestError('You must provide a user Id ')
    }
    if(!req.file){
      throw new BadRequestError('Please No file has been Detected')
    }
    const user = await User.findOne({_id:userId})
    if(!user){
      throw new NotFoundError(`No User found with id:${userId}`)
    }
    const newPost = new Post({
      caption,
      postId: req.file.id, // Save GridFS file ID
      createdBy: userId,
      created: new Date(),
    });
    user.posts.push(req.file.id);
    console.log('\x1b[34m%s\x1b[0m',`User: ${userId} made a post`)
    console.log(req.file)
    await newPost.save();
    await user.save();
    res.status(StatusCodes.CREATED).json({newPost,user});
  
};

exports.getPosts = async (req, res) => {
    const posts = await Post.find().populate('user').populate('comments').sort('-created');
    res.status(StatusCodes.OK).json({nbHits:posts.length,posts});
};


exports.getUserPosts = async (req, res) => {
    const { id } = req.params;//ImageId

    if(!id || id==='null' || id==='undefined'){
      throw new BadRequestError('Please provide the user Id')
    }
    const user = await User.findOne({_id:id})
    if(!user){
      throw new NotFoundError(`No User found with id:${id}`)
    }
    const posts = await Post.find({createdBy: id}).populate('comments').populate('likes').populate('user').sort('-created');
  
    console.log('\x1b[36m%s\x1b[0m',`${user.username} posts found`)
    res.status(StatusCodes.OK).json({message:`${user.username} posts found`,nbHits:posts.length,posts});
};

exports.getImage = async (req, res) => {
    const { id } = req.params;//ImageId
    console.log('\x1b[36m%s\x1b[0m','User Wants to get Image')

    if(!id || id==='null' || id==='undefined'){
      throw new BadRequestError('Please provide the image id')
    }

    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    const file = await gfs.find({ _id: new ObjectId(id) }).toArray();
  
    if (!file||file.length === 0) {
      throw new NotFoundError(`No Image found with id: ${id}`)
    }

    res.set("Content-Type", file[0].contentType);
    res.set("Content-Disposition", `attachment; filename=${file[0].filename}`);

    await gfs.openDownloadStream(new ObjectId(id)).pipe(res);
};

exports.deletePost = async (req, res) => {
        const {userId} = req.query;
        const { fileId } = req.params;
        if (!fileId){
          throw new BadRequestError('Please provide a file id');
        }
        const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
        
        const file = await gfs.find({ _id: new ObjectId(fileId) }).toArray();
  
        if (file.length === 0) {
          throw new NotFoundError(`No Image found with id: ${fileId}`)
        }
        const user = await User.findOne({_id:userId})
        user.posts.forEach((post,index) => {
          const newPostId = JSON.stringify(post).split('"')[1]
          if (newPostId === fileId) {
            console.log(post, index)
            user.posts.splice(index, 1);
          }
        })


        await  gfs.delete(new ObjectId(fileId));
        await user.save();
        const post = await Post.findOneAndDelete({postId:fileId});

        if(!post){
          throw new NotFoundError(`No post found with id: ${fileId}`)
        }
        const comment = await Comment.findOneAndDelete({post:post._id});

        // if(!comment){
        //   throw new NotFoundError(`No comments found with id: postId: ${ post._id}`);
        // }
        res.status(StatusCodes.OK).json({ text: "File deleted successfully!",user,post });
};


exports.likePosts = async (req, res) => {
  const { postId } = req.params;//ImageId

  if(!postId||postId==='undefined'){
    throw new  BadRequestError('Please Provide the postId')
  }

  const {userId} = req.body;
  console.log(req.body)

  if(!userId){
    throw new BadRequestError('Please provide the user Id')
  }
  const user = await User.findById(userId)
  if(!postId || postId==='null' || postId==='undefined'){
    throw new BadRequestError('Please provide the postId Id')
  }
  const post = await Post.findOne({_id:postId})
  if(!post){
    throw new NotFoundError(`No Post found with id:${postId}`)
  }

  if (!post.likes.includes(userId)) {
    post.likes.unshift(userId)
    await post.save();
  }

  console.log('\x1b[36m%s\x1b[0m',`${user.username} liked  post: ${postId}`)
  res.status(StatusCodes.OK).json({message:` ${user.username} unliked post : ${postId}`,post});
};





exports.unlikePosts = async (req, res) => {
  const { postId } = req.params;//ImageId

  const {userId} = req.body;
  console.log(req.body)
  if(!postId||postId==='undefined'){
    throw new  BadRequestError('Please Provide the postId')
  }

  if(!userId){
    throw new BadRequestError('Please provide the user Id')
  }
  const user = await User.findById(userId)
  if(!postId || postId==='null' || postId==='undefined'){
    throw new BadRequestError('Please provide the postId Id')
  }
  const post = await Post.findOne({_id:postId})

  if(!post){
    throw new NotFoundError(`No Post found with id:${postId}`)
  }
  post.likes = user.following.filter(f => f.toString() !== userId);
  await post.save()
  
  console.log('\x1b[36m%s\x1b[0m',`${user.username} unliked post:${postId}`)
  res.status(StatusCodes.OK).json({message:`${user.username} liked post : ${postId}`,post});
};
