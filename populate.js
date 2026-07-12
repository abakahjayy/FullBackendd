//!All this code is used to populate the database depending od the Model(MongoDB).
require('dotenv').config()

const connectDB = require('./db/connect')

//This are the only stuff that you need to change the path to the desired one
const Model = require('./models/Cart.js') //You Can just change the directory of the Model to the model you want
const jsonData = require('./mockData/cart.json')//You Can just change the directory of the MockData to the data you want


const start = async() => {
    try {
        await connectDB(process.env.MONGO_URI).then(() =>console.log('Connected to Database'))
        await Model.deleteMany();//THis will delete all existing products in the database
        await Model.create(jsonData)
        console.log('Success!!!!')
        process.exit(0)//This is used to exit after the code executed
        
    } catch (error) {
        console.log(error);
        process.exit(1)
    }

};
start();