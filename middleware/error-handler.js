const { CustomAPIError } = require('../errors')
const { StatusCodes } = require('http-status-codes')
const errorHandlerMiddleware = (err, req, res, next) => {
  console.warn(err.message);
  console.error('🔴 Forwarding error:', err.message);
  let customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    message: err.message || 'Something went wrong please try again later'
  }

  //We don't need to add this code
  // if (err instanceof CustomAPIError) {
  //   return res.status(err.statusCode).json({ msg: err.message })
  // }

  //This is for the Validation Errors from Mongoose
  if(err.name==='ValidationError') {
    customError.message = Object.values(err.errors)
      .map((item) => item.message).join(',')
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }
  //This is for the duplicate error on mongoose
  if (err.code && err.code === 11000) {//This ${Object.keys(err.keyValue)} refers to the field that contains that value
    customError.message =`The value entered for ${Object.keys(err.keyValue)} field already exists., please choose another value`;
    //Object.keys() will return an array of keys
    customError.statusCode = StatusCodes.BAD_REQUEST;
    // return res.status(StatusCodes.BAD_REQUEST).json({ error: "Username or email already exists." });
  }

  //THis is for the cast Error from Mongoose
  if (err.name === 'CastError') {
    if(Object.values(err.value).length > 2) {
      customError.message = `No item found with id : ${(err.value)}`;
    }
    else{
      customError.message = `No item found with id : ${Object.values(err.value)[0]}`
    }
    customError.statusCode = StatusCodes.NOT_FOUND;
  }
  // return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ err:err.message })
  return res.status(customError.statusCode).json({ msg: customError.message, secret:'',error: customError.message });
}

module.exports = errorHandlerMiddleware;
