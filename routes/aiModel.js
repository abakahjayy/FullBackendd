const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const { StatusCodes } = require('http-status-codes')
const { UnauthenticatedError, BadRequestError, NotFoundError } = require('../errors')
const GpioActivity = require("../models/GpioActivity");
const askOpenAI = require("../utils/openaiService");
const askAi = require("../utils/askAi");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // keep file in memory

router.post('/ask', upload.single('image'), async (req, res) => {
  // try {
  const { prompt, provider } = req.body;
  if (!prompt && !req.file) {
    throw new BadRequestError("Please provide a prompt or image")
  }
  if (!provider) {
    throw new BadRequestError("Please provide a provider(openai or local or openrouter)")
  }
  console.log('\x1b[36m%s\x1b[0m', `Provider: ${provider}`)

  // ✅ Use OpenRouter (free alternative)
  if (provider === "openrouter") {
    let base64Image = null;

    if (req.file) {
      base64Image = req.file.buffer.toString("base64");
    }

    const result = await askAi(prompt, base64Image);
    return res.status(StatusCodes.OK).json({
      type: req.file ? "image+text" : "text",
      input_prompt: prompt,
      response: result,
    });
  }
  // ✅ Use OpenAI
  if (provider === "openai") {
    let base64Image = null;

    if (req.file) {
      base64Image = req.file.buffer.toString("base64");
    }

    const result = await askOpenAI(prompt, base64Image);
    return res.status(StatusCodes.OK).json({
      type: req.file ? "image+text" : "text",
      input_prompt: prompt,
      response: result,
    });
  }
  if(provider!=='local'){
    throw new BadRequestError("Please provide a valid provider(openai or local or openrouter)")
  }

  // ✅ Use your local model (default)
  const form = new FormData();
  if (prompt) form.append("prompt", prompt);
  if (req.file) {
    form.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
  }

  console.log('🟡 Prompt:', prompt);
  console.log('🟢 File:', req.file?.originalname);

  const response = await axios.post('http://localhost:5001/ask', form, {
    headers: form.getHeaders(),
  });

  res.status(StatusCodes.OK).json(response.data);
});

router.post("/gpio/update", async (req, res) => {
  const { pin, state } = req.body;

  if (!pin) return res.status(400).json({ error: "Pin required" });

  // 🔹 Send to AI/Arduino/GPIO logic (or mock GPIO for now)
  console.log(`GPIO: ${pin} turned ${state ? "ON" : "OFF"}`);

  // 🔹 Save to MongoDB
  await GpioActivity.create({
    pin,
    state,
    timestamp: new Date(),
  });

  res.json({ success: true });
});


module.exports = router;
