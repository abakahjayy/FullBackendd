const path = require('path');
const {appPath} =require('../app.js')
// console.log(appPath);
const getHtml =(req, res) => {
    res.sendFile(path.resolve(appPath, './public/homepage/index.html'))
};
const getCss =(req, res) => {
    res.sendFile(path.resolve(appPath, './public/homepage/styles.css'))
};
const getIcon =(req, res) => {
    res.sendFile(path.resolve(appPath, './public/homepage/favicon.ico'))
};
const getJs =(req, res) => {
    res.sendFile(path.resolve(appPath, './public/homepage/index.js'))
};
module.exports = {getHtml,getCss,getIcon,getJs}