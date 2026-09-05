const express = require('express');
const router = express.Router();
//We import the controllers over here
const {
    getHtml,
    getCss,
    getIcon,
    getJs
} = require('../controllers/homepage.js');

//We Setup the routes here
router.route('/').get(getHtml)
router.route('/styles.css').get(getCss)
router.route('/favicon.ico').get(getIcon)
router.route('/index.js').get(getJs)
module.exports = router;
//This is the setup for the homepage in the app.js
// app.get('/', (req, res) => {
//     res.sendFile(path.resolve(__dirname, './public/homepage/index.html'))
// })
// app.get('/styles.css', (req, res) => {
//     res.sendFile(path.resolve(__dirname, './public/homepage/styles.css'))
// })
// app.get('/index.js', (req, res) => {
//     res.sendFile(path.resolve(__dirname, './public/homepage/index.js'))
// })
// app.get('/favicon.ico', (req, res) => {
//     res.sendFile(path.resolve(__dirname, './public/homepage/favicon.ico'))
// })
