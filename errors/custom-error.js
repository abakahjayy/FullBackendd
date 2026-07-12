class CustomAPIError extends Error {
    constructor(message){
        super(message);//We used this to invoke the constructor of  the parent class(Error) on the message parameter
    }
}
//It is advisable to use a function to create a new instance of the class we create
const createCustomError = (message)=>{
    return new CustomAPIError(message);
}
//We are supposed to export both the class and the instance creator
module.exports = {CustomAPIError,createCustomError};