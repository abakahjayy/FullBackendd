from flask import Flask, request, jsonify
from transformers import Blip2Processor, Blip2ForConditionalGeneration, pipeline
import torch
from PIL import Image
import io

# Load BLIP-2 (handles image→text + text→text)
processor = Blip2Processor.from_pretrained("Salesforce/blip2-flan-t5-xl")
model = Blip2ForConditionalGeneration.from_pretrained(
    "Salesforce/blip2-flan-t5-xl",
    torch_dtype=torch.float16,
    device_map="auto"
)

# Init Flask
app = Flask(__name__)

@app.route("/generate_text", methods=["POST"])
def generate_text():
    data = request.get_json()
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400

    inputs = processor(prompt, return_tensors="pt").to("cuda", torch.float16)
    out = model.generate(**inputs, max_new_tokens=100)
    result = processor.decode(out[0], skip_special_tokens=True)

    return jsonify({"response": result})

@app.route("/generate_from_image", methods=["POST"])
def generate_from_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    prompt = request.form.get("prompt", "Describe this image")
    image_file = request.files['image']
    image = Image.open(io.BytesIO(image_file.read())).convert("RGB")

    inputs = processor(image, prompt, return_tensors="pt").to("cuda", torch.float16)
    out = model.generate(**inputs, max_new_tokens=100)
    result = processor.decode(out[0], skip_special_tokens=True)

    return jsonify({"response": result})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
