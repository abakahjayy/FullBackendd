const mongoose = require('mongoose')
const ProductSchema = new mongoose.Schema({
    image: {
        type: String,
        required: [true, 'Please Add your Image'],
    },
    name: {
        type: String,
        required: [true, 'Please Enter your name'],
    },
    rating: {
        type: Object,
        stars: {type:Number,default:4.0},
        count: {type:Number,default:50}
    },
    priceCents: {
        required: [true, 'Please Enter your product price'],
        type: Number
    },
    keywords: [{
        type: String
    }],
    type: {
        type: String
    },
    sizeChartLink: {
        type: String
    },
    instructions: {type: String},
    warranty: {type: String},
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
    },
},
{ timestamps: true })//An extra Schema parameter for timestamps(important)



const Products = mongoose.model("Products", ProductSchema);
module.exports = Products;
