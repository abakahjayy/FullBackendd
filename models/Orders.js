const mongoose = require('mongoose')
const OrderSchema = new mongoose.Schema([{
        orderTime: {
            type:String,
            required:[true,'Please Provide the Date Ordered']
        },
        totalCostCents: {
            type: Number,
            required: [true, 'Please Provide the total costs']
        },
        products: [
            {
                productId: {
                    type: mongoose.Types.ObjectId,
                    ref: 'Products',
                    required: [true, 'Please Provide a Product ID']
                },
                quantity: {
                    type: Number, required: [true, 'Please Provide the Product Quantity']
                },
                deliveryOptionId: {
                    type: String,
                    required: [true, 'Please Provide the Delivery Option ID']
                },
                estimatedDeliveryTime: {
                    type: String,
                    required: [true, 'Please Provide the estimated delivery time']
                }
            }
        ],
    
        createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        }
}],{ timestamps: true })//An extra Schema parameter for timestamps(important)

const Orders = mongoose.model("Orders", OrderSchema);
module.exports = Orders;
