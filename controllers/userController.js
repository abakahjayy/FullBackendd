const { UnauthenticatedError, BadRequestError,NotFoundError } = require('../errors')
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');

exports.followUser = async (req, res) => {
  const { id } = req.params;//UserId
  if(!id){
    throw new BadRequestError('Please Provide a user id')
  }

  const userId = req.body.userId;//FollowerId

  if(!userId){
    throw new BadRequestError('Please Provide a following id')
  }

    const user = await User.findById(id);

    if(!user){
      throw new NotFoundError(`No user with id: ${id}`)
    }


    const following = await User.findById(userId);


    if(!following){
      throw new NotFoundError(`No follower with id: ${userId}`)
    }

    if (!user.following.includes(userId)) {
      user.following.push(userId);
      following.followers.push(id);
      await user.save();
      await following.save();
    }
    console.log( '\x1b[32m%s\x1b[0m',`You: ${user.username} followed ${following.username}!`)
    res.status(StatusCodes.OK).json({ message: `You: ${user.username} followed ${following.username}!` ,user,following});
  
};

exports.unfollowUser = async (req, res) => {
  const { id } = req.params;//UserId
  if(!id){
    throw new BadRequestError('Please Provide a user id')
  }

  const {userId }= req.body;//FollowerId

  if(!userId){
    throw new BadRequestError('Please Provide a follower id')
  }

    const user = await User.findById(id);

    if(!user){
      throw new NotFoundError(`No user with id: ${id}`)
    }


    const following = await User.findById(userId);


    if(!following){
      throw new NotFoundError(`No follower with id: ${userId}`)
    }


    user.following = user.following.filter(f => f.toString() !== userId);
    following.followers = following.followers.filter(f => f.toString() !== id);

    await user.save();
    await following.save();
    console.log( '\x1b[31m%s\x1b[0m',`You: ${user.username} unfollowed ${following.username}!`)

    res.status(StatusCodes.OK).json({ message: `You: ${user.username} unfollowed ${following.username}!` ,user,following});
  
};

exports.getUser = async (req, res) => {
    const {id} = req.params
    if(!id){
      throw new BadRequestError('Please Provide a user id')
    }
    const user = await User.findById(id).populate('followers following');
    if(!user){
      throw new NotFoundError(`No user with id: ${id}`)
    }
                                                                                                                                      
    console.log('\x1b[36m%s\x1b[0m',`Username: ${id} found`)
    res.status(StatusCodes.OK).json({message:`User: ${id} found successfully `,user});
};
exports.getAllUsers = async (req, res) => {
    let limit=Number(req.query.limit)
    if(!limit){
      limit=5;
    }
    const users = await User.find({}).populate('followers following').sort('-created').limit(limit);
    if(!users){
      throw new NotFoundError(`No users found in database`);
    }
    res.status(StatusCodes.OK).json({message:`Users found successfully`,nbHits:users.length,users});
};

exports.getUserByName = async (req, res) => {
    const {username} = req.params
    if(!username){
      throw new BadRequestError('Please Provide a username')
    }
    // console.warn('Hi')
    const user = await User.findOne({username:username}).populate('followers following')
    User
    if(!user){
      throw new NotFoundError(`No user with username: ${username}`)
    }
    console.log('\x1b[36m%s\x1b[0m',`Username: ${username} found`)
    res.status(StatusCodes.OK).json({message:`User: ${username} found successfully `,user});
};


exports.editUser = async (req, res) => {
  const {username} = req.params
  const {usernames,bio,firstName,lastName,phone,email} = req.body.updatedUser?req.body.updatedUser:req.body
  console.log(`User: ${username} is editing the profile`)
  console.log(req.body)
  if(!username){
    throw new BadRequestError('Please Provide a username')
  }

  const user = await User.findOneAndUpdate({username:username},{username:usernames,bio,firstName,lastName,phone,email},{ new: true, runValidators: true })//.populate('followers following')
  if(!user){
    throw new NotFoundError(`No user with username: ${username}`)
  }
  if(req.file){
    console.log(req.file)
    user.profile_picture_id = req.file.id;
    await user.save()
  }
  console.log('\x1b[36m%s\x1b[0m',`Username: ${username} updated user details successfully `)
  res.status(StatusCodes.OK).json({message:`User: ${username} updated user details successfully `,user});
};


exports.editUserProfilePic = async (req, res) => {
  const {username} = req.params
  console.log(username)
  if(!username){
    throw new BadRequestError('Please Provide a username')
  }

  if(!req.file){
    throw new BadRequestError('Please Provide an Image')
  }

  const user = await User.findOne({username:username})
  
  if(!user){
    throw new NotFoundError(`No user with username: ${username}`)
  }
  
  // console.log(req.file)
  user.profile_picture_id = req.file.id;
  await user.save()
  console.log('\x1b[36m%s\x1b[0m',`Username: ${username} updated user profile pic successfully `)
  res.status(StatusCodes.OK).json({message:`User: ${username} updated user profile pic successfully `,user});
};

// ✅ Delete a user by username
exports.deleteUser = async (req, res) => {
  const  username  = req.params.id;

  if (!username) {
    throw new BadRequestError('Please provide a username');
  }

  const user = await User.findOneAndDelete({ _id:username });

  if (!user) {
    throw new NotFoundError(`No user with username: ${username}`);
  }

  console.log('\x1b[31m%s\x1b[0m', `User: ${username} deleted successfully`);
  res.status(StatusCodes.OK).json({ message: `User: ${username} deleted successfully`, user });
};
