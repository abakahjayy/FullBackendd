const Delivery = require('../models/Delivery.js')
const {StatusCodes}=require('http-status-codes')
const {BadRequestError,NotFoundError}= require('../errors');



const getDeliveryData = async(req,res)=>{
    const deliverys = await Delivery.find({})
    res.status(StatusCodes.OK).json({msg:'Delivery Data Found',nbHits:deliverys.length,deliverys})
}
const getOneDeliveryData = async(req,res)=>{
    const {deliveryOptionId}= req.params
    console.log(deliveryOptionId)
    const delivery = await Delivery.findOne({deliveryOptionId:deliveryOptionId})
    if(!delivery){
        throw new NotFoundError(`No delivery found for ${deliveryOptionId}`)
    }
    res.status(StatusCodes.OK).json({msg:'Delivery Data Found',nbHits:1,delivery})
}

module.exports = {
    getDeliveryData,
    getOneDeliveryData
}