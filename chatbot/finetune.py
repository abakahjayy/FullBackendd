from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TextDataset,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments
)

# Load tokenizer and model from local directory
model_dir = "./model"
tokenizer = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForCausalLM.from_pretrained(model_dir)

# Prepare dataset
def load_dataset(file_path, tokenizer, block_size=128):
    return TextDataset(
        tokenizer=tokenizer,
        file_path=file_path,
        block_size=block_size
    )

train_dataset = load_dataset("data/my_dataset.txt", tokenizer)

# Data collator
data_collator = DataCollatorForLanguageModeling(
    tokenizer=tokenizer,
    mlm=False
)

# Training arguments
training_args = TrainingArguments(
    output_dir="./finetuned_model",
    overwrite_output_dir=True,
    num_train_epochs=3,
    per_device_train_batch_size=2,
    save_steps=100,
    save_total_limit=1,
    logging_dir="./logs"
)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    data_collator=data_collator,
    train_dataset=train_dataset
)

# Start training
trainer.train()

# Save final model
model.save_pretrained("./finetuned_model")
tokenizer.save_pretrained("./finetuned_model")

print("✅ Fine-tuning complete. Model saved to ./finetuned_model")


# from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer

# model = AutoModelForCausalLM.from_pretrained("./finetuned_model")
# tokenizer = AutoTokenizer.from_pretrained("./finetuned_model")

# generator = pipeline("text-generation", model=model, tokenizer=tokenizer)
# output = generator("Your prompt here", max_length=100, do_sample=True)
# print(output[0]["generated_text"])