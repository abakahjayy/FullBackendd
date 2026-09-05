const mongoose = require('mongoose')
const DeliverySchema = new mongoose.Schema([{
            deliveryOptionId: {
                enum:['1','2','3'],
                type:String,
                required:[true,'Please Provide the Delivery Option ID']
            },
            priceCents: {
                type:Number, required:[true,'Please Provide the Delivery Cost in Cents']
            },
            deliveryDays: {
                type:Number, required:[true,'Please Provide the Delivery Days']
            },
            createdBy: {
                type: mongoose.Types.ObjectId,
                ref: 'User',
            },
}],
{ timestamps: true })//An extra Schema parameter for timestamps(important)



const Delivery = mongoose.model("Delivery", DeliverySchema);
module.exports = Delivery;
