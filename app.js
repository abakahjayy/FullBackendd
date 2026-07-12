require('dotenv').config();
const fs = require('fs');
require('express-async-errors');


//This is just saving the path into a variable and exporting it to use elsewhere
const appPath = __dirname;
module.exports = { appPath };
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const expressJSDocSwagger = require('express-jsdoc-swagger');





const path = require('path');
//This are all the files required to run this application
const express = require('express');
const bodyParser = require("body-parser");
const logger = require("morgan");
const app = express();
const expressOasGenerator = require('express-oas-generator');
// expressOasGenerator.init(app, {
//     writeIntervalMs: 3000, // write faster
//     swaggerUiServePath: '/api-docs',
// });
const cors = require("cors");
const connectDB = require('./db/connect.js');
const mongoose = require('mongoose')
const helmet = require('helmet');
const morgan = require('morgan');
const { notFound } = require('./middleware/not-found.js');
const errorHandler = require('./middleware/error-handler.js')
const homepage = require('./routes/homepage.js');
const authRoutes = require("./routes/auth.js");
const uploadRoutes = require("./routes/upload.js");
const productsRouter = require('./routes/products.js')
const cartRouter = require('./routes/cart.js')
const ordersRouter = require('./routes/orders.js')
const ordersdataRouter = require('./routes/MTNOrders.js')
const testing1Router = require('./routes/testing1.js')
const deliveryRouter = require('./routes/delivery.js')
const changeDelRouter = require('./routes/cart2.js')
const messageRoutes = require('./routes/messageRoutes');
const setupSocket = require('./utils/socket');
const userRoutes = require('./routes/userRoute');
const userProfilePic = require('./routes/userProfilePic');
const postRoutes = require('./routes/postRoute');
const commentRoutes = require('./routes/commentRoute');
const googleAuth = require('./routes/googleAuth');
const aiRoutes = require('./routes/chatAi');
const aiModelRoutes = require('./routes/aiModel');
const aiImageRoutes = require('./routes/sendAiImage');
const uniServe = require('./routes/UniServe.js');//Uniserver
const passport = require("passport");
const downloadExcelRoute = require('./routes/downloadExcel');
const ussdRoutes = require("./routes/ussdRoutes");
const muviinRoutes = require("./routes/muviin");
const ussd = require("./routes/ussd.js");
const authMiddleware = require("./middleware/auth.js");
const htmlAuth = require('./middleware/htmlAuth'); // Import it
const reloadlyRoutes = require('./routes/reloadlyRoutes');
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");//This handles user logins  and stuff
const paystackRoutes = require("./routes/paystackRouter");
const bundleRoutes = require('./routes/bundleRoutes');
const afaRoutes = require('./routes/afa');
const mealRoutes = require("./routes/mealRoutes");
const foodordersRoutes = require("./routes/foodorders");

const feedbackRoutes = require("./routes/foodFeedback");
// console.log(ClerkExpressRequireAuth)


const { spawn } = require('child_process');//Used to run python code with javascript
require("./utils/passport"); // Passport configuration file





app.use(cors());//This allows connections from other ports
// Serve the generated OpenAPI JSON and Swagger UI
const openApiPath = path.join(__dirname, 'oas-docs', 'openapi.json');
if (fs.existsSync(openApiPath)) {
    const openApiSpec = JSON.parse(fs.readFileSync(openApiPath));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
} else {
    console.warn('⚠️ Swagger UI not available yet. Make some API requests to generate openapi.json');
}


// Serve the uploaded images from the /uploads folder in code
app.use("/api/v1/auth/", uploadRoutes);

app.use(bodyParser.json());
app.use(logger("dev"));
// app.use(morgan('tiny'))


//We put all the file upload routes up here so that it doesn't get affected by some middleware for json
// Serve the uploaded images from the /uploads folder in database
app.use('/api/v1/uploadFiles/', testing1Router)

app.use('/api/v1/userse', userProfilePic);
//This is for posts

app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/ai', aiImageRoutes);
app.use('/api/v1/ai', aiModelRoutes);

app.use("/api/v1/meals", mealRoutes);

// Initialize Passport
app.use(passport.initialize());


// rest of the packages
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const rateLimiter = require('express-rate-limit');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');


//All this is for license for https secure
const https = require('https');
// const sslOptions = {
    //     key: fs.readFileSync('./key.pem'), // Path to your private key
    //     cert: fs.readFileSync('./cert.pem') // Path to your certificate
    // };
    
    
    //This is for the messaging
const http = require('http');
// const socketIo = require('socket.io');
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*', // Allow any origin for development
        methods: ['GET', 'POST'],
    },
});






//Middleware




// app.use(session({
//     secret: process.env.SESSION_KEY,
//     resave: true,
//     saveUninitialized: true,
// }));
// app.use(morgan('tiny'));
app.use(express.static('./public'))
app.use(express.static('./static'))


// Use Helmet for security
app.use(helmet());


//Other middleware
const apiLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100000, // limit each IP to 100 requests per windowMs
})
app.use("/api/", apiLimiter);


app.use(xss());
app.use(mongoSanitize());
app.use(cookieParser(process.env.JWT_SECRET));
app.use(fileUpload());


// Parse incoming JSON requests
app.use(express.urlencoded({ extended: false }));
app.use(express.json());


// Routes to API's
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/auth", googleAuth);
app.use('/api/v1/products', productsRouter)
app.use('/api/v1/cart', cartRouter)
app.use('/api/v1/orders', ordersRouter)
app.use('/api/v1/ordersdata', ordersdataRouter)
app.use('/api/v1/delivery', deliveryRouter)
app.use('/api/v1/changedel', changeDelRouter)
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/users', userRoutes);

app.use('/api/v1/comments', commentRoutes);

//This is for the Ai
app.use('/api/v1/ai', aiRoutes);


app.use('/api/v1/uniserve', uniServe);

app.use('/api/v1/export', downloadExcelRoute);

app.use("/api/v1/ussd", ussdRoutes);

app.use("/api/v1/muviin", muviinRoutes);

app.use("/api/v1/ussds", ussd);
app.use('/api/v1/reloadly', reloadlyRoutes);

// Use Routes
app.use("/api/v1/paystack", paystackRoutes);

app.use('/api/v1/bundles', bundleRoutes);

app.use('/api/v1/afa', afaRoutes);

app.use("/api/v1/foodorders", foodordersRoutes);

app.use("/api/v1/feedbacks", feedbackRoutes);




//This is the login page for the mtn data login


// Loosen CSP to allow inline scripts and styles
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
        "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https://www.gravatar.com https://s3.amazonaws.com;"
    );
    next();
});


app.get('/api/v1/bundle/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'login.html'));
});

//This is the dashboard page for the mtn data bundle page
app.get('/api/v1/bundle/', htmlAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'afrodata.html'));
});

app.get('/api/v1/buydata/', htmlAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'buydata.html'));
});
app.get('/static/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'favicon.ico'));
});

app.get('/afrodatahome', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'afrohome.html'));
});

app.get('/afrodatadashboard',htmlAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'dashboard.html'));
});

app.get('/resetPassword', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'resetPassword.html'));
});

app.get('/datasuccess', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'success.html'));
});

app.get('/font-awesome/css/all.min.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', '/font-awesome/css/all.min.css'));
});


//This is for the Ai Chatbot
app.post('/api/chat', (req, res) => {
    const userMessage = req.body.message;

    const python = spawn('C:/ProgramData/anaconda4/python.exe', ['./chatbot/respond.py', userMessage]);//This is used to run python in javascript

    python.stdout.on('data', (data) => {
        res.json({ reply: data.toString() });//This will send the printed message
    });

    python.stderr.on('data', (data) => {//This will send the error
        console.error(`Error: ${data}`);
    });
});

// Setup Socket.IO
setupSocket(io);

app.use(homepage)


// Basic error handling middleware
app.use(notFound);
app.use(errorHandler);


//This app has a listening problem
const port = process.env.PORT || 7004;
//If there are  port problems :   npx kill-port 7004


const start = async () => {
    try {
        //Connect the Database
        //We must always include our connect database method in the server application
        console.log(process.env.MONGO_URI)
        await connectDB(process.env.MONGO_URI).then(() => {
            console.log('\x1b[36m%s\x1b[0m', '🔄Connected to MongoDB...')
            console.log('\x1b[36m%s\x1b[0m', '🔌 Connecting to:', process.env.MONGO_URI);

        })
        await expressOasGenerator.handleResponses(app, {
            specOutputPath: path.join(__dirname, 'oas-docs', 'openapi.json'),
            alwaysServeDocs: true,
            serveDocs: true,
            swaggerUiServePath: '/api-docs',
        });

        server.listen(port, console.log('\x1b[42m%s\x1b[0m', `🚀 Server Running on === http://localhost:${port}`));
        // https.createServer(sslOptions, app).listen(port, () => {
        //     console.log(`Server running on https://localhost:${port}`);
        // });
    } catch (error) {
        console.log('Could not connect to MongoDB...');
        console.log(`Error: ${error}`);
    }
}
start();

