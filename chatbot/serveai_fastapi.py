#cd chatbot
#To run with flask: uvicorn serveai_fastapi:app --host 0.0.0.0 --port 5001 --reload
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from transformers import (
    BlipProcessor,
    BlipForConditionalGeneration,
    AutoTokenizer,
    AutoModelForCausalLM,
    pipeline
)
from PIL import Image
import torch
import io
import serial
import time

app = FastAPI()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("🖥️  Device:", device)

# Load local model paths
blip_path = "./models/blip/models--Salesforce--blip-image-captioning-base/snapshots/82a37760796d32b1411fe092ab5d4e227313294b"
gpt_path = "./models/gpt2/models--distilgpt2/snapshots/2290a62682d06624634c1f46a6ad5be0f47f38aa"

# Load models locally
print("🔄 Loading BLIP...")
blip_processor = BlipProcessor.from_pretrained(blip_path)
blip_model = BlipForConditionalGeneration.from_pretrained(blip_path).to(device)

print("🔄 Loading GPT...")
gpt_tokenizer = AutoTokenizer.from_pretrained(gpt_path)
gpt_model = AutoModelForCausalLM.from_pretrained(gpt_path).to(device)
gpt_model.eval()

text_generator = pipeline(
    "text-generation",
    model=gpt_model,
    tokenizer=gpt_tokenizer,
    max_length=5000,
    do_sample=True,
    top_k=50,
    top_p=0.95,
    temperature=0.8,
    repetition_penalty=1.2,
    device=0 if torch.cuda.is_available() else -1,
)

# CORS (for your frontend to access it)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "🧠 Multimodal AI (FastAPI) is running offline"}

@app.post("/ask")
async def ask(
    prompt: str = Form(""),
    image: UploadFile = File(None)
):
    try:
        if image:
            print("📷 Image received")
            image_bytes = await image.read()
            pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            inputs = blip_processor(images=pil_image, text=prompt or "Describe this image", return_tensors="pt").to(device)
            output_ids = blip_model.generate(**inputs)
            caption = blip_processor.decode(output_ids[0], skip_special_tokens=True)

            return JSONResponse(content={
                "type": "image+text",
                "input_prompt": prompt,
                "response": caption
            })

        elif prompt.strip():
            print("📝 Prompt received:", prompt)
            out = text_generator(prompt, num_return_sequences=1)
            return JSONResponse(content={
                "type": "text",
                "input_prompt": prompt,
                "response": out[0]["generated_text"]
            })

        else:
            return JSONResponse(content={"error": "Provide a prompt or image"}, status_code=400)

    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=500)





# Arduino Setup (adjust COM port)
# arduino = serial.Serial("COM4", 9600, timeout=1)
# time.sleep(2)

# @app.post("/control")
# def control_arduino(command: str = Form(...)):
#     try:
#         arduino.write((command + '\n').encode())
#         return {"message": f"Sent '{command}' to Arduino"}
#     except Exception as e:
#         return {"error": str(e)}
#This is for the fast api