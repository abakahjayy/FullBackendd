const mongoose = require('mongoose')
const validator = require('validator')
const CartSchema = new mongoose.Schema([{
        products:[{
            deliveryOptionId: {
                default:'1',
                type:String,
                required:[true,'Please Provide the Delivery Option ID']
            },
            dateOrdered: {
                type:String,
                required:[true,'Please Provide the Date Ordered']
            },
            productId: {
                type: mongoose.Types.ObjectId,
                ref: 'Products',
                required:[true,'Please Provide a Product ID']
            },
            quantity: {
                type:Number, required:[true,'Please Provide the Product Quantity']
            },
        }],
        totalCartCents: {
            type:Number, required:[true,'Please Provide Cart Total Cost in Cents'],
        },
        totalDeliveryCents: {
            type:Number, required:[true,'Please Provide Cart Total Delivery in Cents'],
        },
        createdBy: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
        },
}],
{ timestamps: true })//An extra Schema parameter for timestamps(important)



const Orders = mongoose.model("Cart", CartSchema);
module.exports = Orders;
