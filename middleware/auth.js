const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const { UnauthenticatedError } = require('../errors');

const authenticationMiddleware = async (req, res, next) => {
    let token;

    // Priority 1: Bearer token in header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // Priority 2: Token from cookie
    if (!token && req.cookies?.token) {
        token = req.cookies.token;
    }

    // Priority 3: Token from query (e.g. ?oven=token)
    if (!token && req.query.oven) {
        token = req.query.oven;
    }

    if (!token || token === 'undefined') {
        throw new UnauthenticatedError('No valid token provided.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { userId, username } = decoded;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            throw new UnauthenticatedError('User not found.');
        }

        req.user = { userId, username, token };
        console.log('✅ Token verified');
        next();
    } catch (error) {
        throw new UnauthenticatedError(`Not authorized: ${error.message}`);
    }
};

module.exports = authenticationMiddleware;


// const jwt = require('jsonwebtoken');
// const User = require('../models/User.js')

// const {UnauthenticatedError } = require('../errors')



// const authenticationMiddleware = async (req, res, next) => {
//     //We get the token from the headers of there request
//     // console.log(req.headers.authorization);
//     const authHeader = req.headers.authorization
//     let token = req.cookies?.token || req.query.oven;
//     // console.log(authHeader)
    
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')){
//         throw new UnauthenticatedError('No token provided/Header Authorization(Bearer)')
//     }
//     token = authHeader.split(' ')[1]

//     // console.log(token)
//     if(token==='undefined'){
//         console.warn('No token provided')
//         return
//     }

//     try {
//             //Verify the token if its valid
//             const decoded = jwt.verify(token, process.env.JWT_SECRET);
//             // console.log(decoded);

//             //We got the value of the payload(data) after decoding the token and destructured it
//             const { userId, username } = decoded//(payload)

//             //We could also use the token payload id to   retrieve the user information with the user model
//             const user = await User.findById(userId).select('-password');//Select will omit that parameter
//             //The select method removes the password from the response
//             // req.user = user;


//             //We assigned the destructured values to the req.user variables
//             req.user = { userId, username,token }
//             // console.log({token})
//             console.log('Token verified')
//             //And then we go to the next step which is in the controllers
//             next();
//     } catch (error) {
//         throw new UnauthenticatedError(`Not authorized  to access this route , Error: ${error.message}`)
//     }
// }

// module.exports = authenticationMiddleware
