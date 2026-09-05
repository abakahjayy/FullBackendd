from flask import Flask, request, jsonify
from transformers import (
    BlipProcessor,
    BlipForConditionalGeneration,
    pipeline,
    AutoModelForCausalLM,
    AutoTokenizer
)
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
import torch

# ─── Setup ───────────────────────────────────────────────────────────────
# app = FastAPI()
app = Flask(__name__)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print('Device:', device)

# ─── Load Models from Local ──────────────────────────────────────────────
print("🔄 Loading BLIP (image model)...")
blip_processor = BlipProcessor.from_pretrained("./models/blip/models--Salesforce--blip-image-captioning-base/snapshots/82a37760796d32b1411fe092ab5d4e227313294b")
blip_model = BlipForConditionalGeneration.from_pretrained("./models/blip/models--Salesforce--blip-image-captioning-base/snapshots/82a37760796d32b1411fe092ab5d4e227313294b").to(device)
print("🔄 Loading DistilGPT2 (text model)...")
gpt_tokenizer = AutoTokenizer.from_pretrained("./models/gpt2/models--distilgpt2/snapshots/2290a62682d06624634c1f46a6ad5be0f47f38aa")
gpt_model = AutoModelForCausalLM.from_pretrained("./models/gpt2/models--distilgpt2/snapshots/2290a62682d06624634c1f46a6ad5be0f47f38aa").to(device)
gpt_model.eval()

text_generator = pipeline(
    "text-generation",
    model=gpt_model,
    tokenizer=gpt_tokenizer,
    max_length=150,
    do_sample=True,
    top_k=50,
    top_p=0.95,
    temperature=0.8,
    repetition_penalty=1.2,
    device=0 if torch.cuda.is_available() else -1,
)

# ─── Routes ──────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "🧠 Multimodal AI (local) is running!"})


@app.route("/ask", methods=["POST"])
def ask():
    prompt = request.form.get("prompt", "").strip()
    image_file = request.files.get("image")

    try:
        if image_file:
            image = Image.open(image_file).convert("RGB")
            inputs = blip_processor(images=image, text=prompt or "Describe this image", return_tensors="pt").to(device)
            output_ids = blip_model.generate(**inputs, max_length=128)
            result = blip_processor.decode(output_ids[0], skip_special_tokens=True)

            return jsonify({
                "type": "image+text",
                "input_prompt": prompt,
                "response": result
            })

        elif prompt:
            text_outputs = text_generator(prompt, num_return_sequences=1)
            return jsonify({
                "type": "text",
                "input_prompt": prompt,
                "response": text_outputs[0]["generated_text"]
            })

        else:
            return jsonify({"error": "No prompt or image provided."}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Run Server ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 Server running at http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
