const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // keep file in memory

router.post('/ask', upload.single('image'), async (req, res) => {
  try {
    const { prompt } = req.body;
    const form = new FormData();

    if (prompt) {
      form.append('prompt', prompt);
    }

    if (req.file) {
      form.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
    }

    const response = await axios.post('http://localhost:5001/ask', form, {
      headers: form.getHeaders()
    });

    res.json(response.data);
  } catch (err) {
    console.error('Forwarding error:', err.message);
    res.status(500).json({ error: 'Failed to forward request to AI server' });
  }
});

module.exports = router;
