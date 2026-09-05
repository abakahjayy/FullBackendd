// routes/downloadExcel.js
const express = require('express');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const Chat = require('../models/ChatAi');
const UserChats = require('../models/UserChatAi');
const Posts = require('../models/Posts');
const Cart = require('../models/Cart');
const Delivery = require('../models/Delivery');
const Products = require('../models/Products');
const User = require('../models/User');
const Token = require('../models/Token');
const Message = require('../models/Message');
const Comment = require('../models/Comments');
const GpioActivity = require('../models/GpioActivity');
const Orders = require('../models/Orders');
/// New educational models
const University = require('../models/University');
const Program = require('../models/Program');
const StudentInput = require('../models/StudentInput');
const RequiredSubject = require('../models/RequiredSubject');
const UssdSession = require("../models/UssdSession");

const router = express.Router();

// All models in one place
const models = {
    Chat,
    UserChats,
    Posts,
    Cart,
    Delivery,
    Products,
    User,
    Token,
    Message,
    Comment,
    GpioActivity,
    Orders,
    University,
    Program,
    StudentInput,
    RequiredSubject,
    UssdSession
};

router.get('/download/:modelName', async (req, res) => {
    const { modelName } = req.params;

    const Model = models[modelName];
    if (!Model) {
        return res.status(400).json({ error: 'Invalid model name' });
    }

    try {
        const data = await Model.find().lean();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${modelName} Data`);

        if (data.length === 0) {
            worksheet.addRow(['No data available']);
        } else {
            // Get keys from first item as headers
            const headers = Object.keys(data[0]);
            worksheet.addRow(headers);

            data.forEach(item => {
                worksheet.addRow(headers.map(h => item[h]));
            });
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=${modelName}_data.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ error: 'Failed to generate Excel' });
    }
});

module.exports = router;
