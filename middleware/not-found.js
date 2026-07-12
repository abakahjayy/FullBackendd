const {StatusCodes} = require('http-status-codes');
const path = require('path');
const notFound = (req, res) =>{
    console.warn(req.path)
    res.status(StatusCodes.NOT_FOUND).sendFile(path.resolve(__dirname,'../public/Not-Exist/not.html'))
};
// const notFound = (req, res) => res.status(404).send({message: 'Route does not exist'})
module.exports = {notFound}
