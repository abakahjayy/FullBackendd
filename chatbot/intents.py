# import sys
# import pickle
# from transformers import pipeline

# # Load the traditional model
# with open("./chatbot/chatbot_model.pkl", "rb") as f:
#     model, vectorizer = pickle.load(f)

# # Load GPT-2 pipeline (text generation)
# chatbot = pipeline('text-generation', model='gpt2')

# def get_intent(user_input):
#     """Predicts the intent using the traditional model"""
#     X = vectorizer.transform([user_input])
#     prediction = model.predict(X)
#     return prediction[0]

# def get_response(user_input):
#     """Generates a response using GPT-2"""
#     response = chatbot(user_input, max_length=50, num_return_sequences=1)
#     return response[0]['generated_text']

# if __name__ == "__main__":
#     user_input = sys.argv[1]
#     intent = get_intent(user_input)
#     reply = get_response(user_input)

#     print(f"Intent: {intent}")
#     print("Response:", reply)



import sys
import json
import random
import pickle

# Load the trained model and vectorizer
with open("./chatbot/chatbot_model.pkl", "rb") as f:
    model, vectorizer = pickle.load(f)

# Load intents data
with open("./chatbot/intents.json", "r") as f:
    intents = json.load(f)

# Predict intent
def predict_intent(message):
    X = vectorizer.transform([message])
    intent = model.predict(X)[0]
    return intent

# Get response from intents.json
def get_response(intent_tag):
    for intent in intents['intents']:
        if intent['tag'] == intent_tag:
            return random.choice(intent['responses'])
    return "I'm not sure how to respond to that."

# Entry point
if __name__ == "__main__":
    user_input = sys.argv[1]
    intent = predict_intent(user_input)
    reply = get_response(intent)
    print(reply)
