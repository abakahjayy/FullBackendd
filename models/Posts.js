const mongoose = require('mongoose')
const PostSchema = new mongoose.Schema({
        postId: {
                    type: mongoose.Types.ObjectId,
                    ref: 'uploads',
                    required: [true, 'Please Provide a Post ID']
                },
        likes: [
            {
                type: mongoose.Types.ObjectId,
                ref: 'User',
                default:null,
            }
        ],
        // What postId points at in GridFS - decides <img> vs <video> on the client.
        mediaType: {type:String, enum:['image','video'], default:'image'},
        caption: {type:String,default:''},
        comments: [
            {
                type: mongoose.Types.ObjectId,
                ref: 'Comment',
                default:null,
            }
        ],
        createdBy: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: [true, 'Please Provide the User Id']
        },
        created:{
            type:Number,
            default:Date.now()
        }
},{ timestamps: true })//An extra Schema parameter for timestamps(important)

const Posts = mongoose.model("Posts", PostSchema);
module.exports = Posts;
