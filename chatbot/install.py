from transformers import BlipProcessor, BlipForConditionalGeneration, AutoTokenizer, AutoModelForCausalLM

# Download BLIP
blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base", cache_dir="./models/blip")
blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base", cache_dir="./models/blip")

# Download GPT2
gpt_tokenizer = AutoTokenizer.from_pretrained("distilgpt2", cache_dir="./models/gpt2")
gpt_model = AutoModelForCausalLM.from_pretrained("distilgpt2", cache_dir="./models/gpt2")
