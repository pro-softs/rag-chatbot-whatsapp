# **Dynamic WhatsApp Chatbot with Twilio, OpenAI & Pinecone** 🚀

This is a **fully customizable WhatsApp chatbot** built using **Twilio, OpenAI, and Pinecone**, allowing users to configure **conversation flows, FAQs, and API integrations** via a simple **JSON-based setup**.

## **🔹 Features**
✅ **Customizable Flow:** Define your chatbot’s conversation flow in `flow.json`.  
✅ **AI-Powered FAQ Search:** Uses **Pinecone vector search** for fast, relevant responses.  
✅ **Real-time API Calls:** Fetch dynamic data from external APIs, configurable in `flow.json`.  
✅ **OpenAI Fallback:** If no FAQ match is found, AI generates a response.  
✅ **WhatsApp-Ready:** Built for **Twilio WhatsApp API**, instantly deployable.  
✅ **State Management:** Uses **Redis** for seamless conversation tracking.  
✅ **Zero Code Changes Needed:** Just update JSON files & run the bot!

---

## **📌 Installation**
### **1️⃣ Clone the Repository**
```sh
git clone https://github.com/your-username/whatsapp-chatbot.git
cd whatsapp-chatbot
```

### **2️⃣ Install Dependencies**
```sh
npm install
```

### **3️⃣ Set Up Environment Variables**
Create a `.env` file with:
```env
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=faqs
REDIS_URL=your_redis_url
PORT=3000
```

---

## **📌 Configuration**
### **Define Chatbot Flow (`flow.json`)**
Modify `flow.json` to **customize the chatbot**:
```json
{
  "welcome": {
    "type": "plain",
    "message": "Welcome to our chatbot! How can I help?",
    "next": "main"
  },
  "main": {
    "type": "branch",
    "branches": [
      { "condition": "1", "next": "propertySearch" },
      { "condition": "2", "next": "faqNode" },
      { "condition": "3", "next": "support" }
    ]
  },
  "propertySearch": {
    "type": "api",
    "message": "Searching for properties...",
    "api": {
      "url": "https://api.example.com/properties",
      "method": "GET",
      "params": ["city", "budget"]
    },
    "next": "closingNode"
  },
  "faqNode": {
    "type": "faq",
    "next": "main"
  },
  "support": {
    "type": "plain",
    "message": "Contact support at support@example.com",
    "next": "main"
  }
}
```

### **Add FAQs (`faqs.json`)**
```json
[
  {
    "id": "faq_1",
    "question": "What is ZeroDeposit Rental?",
    "answer": "ZeroDeposit replaces traditional security deposits with a financial guarantee."
  },
  {
    "id": "faq_2",
    "question": "How much does the Rental Guarantee cost?",
    "answer": "The guarantee fee is 9% of the deposit amount."
  }
]
```

---

## **📌 Upload FAQs to Pinecone**
```sh
node upload_faqs.js
```

---

## **📌 Run the Chatbot**
```sh
node bot.js
```

---

## **📌 Webhook Setup for Twilio**
1. **Go to Twilio Console → Messaging → WhatsApp Senders**  
2. **Set Webhook URL:**  
   ```
   https://your-server.com/webhook
   ```
3. **Method:** `POST`  
4. **Save and Test** by sending a message to your Twilio number.

---

## **🚀 Deployment**
### **Railway**
1. **Deploy on [Railway.app](https://railway.app)**
2. **Add Environment Variables** from `.env`
3. **Deploy & Start the Bot!**

### **Render**
1. **Push Code to GitHub**
2. **Deploy on [Render.com](https://render.com)**
3. **Expose Webhook**

### **Self-Hosting**
Run using **PM2**:
```sh
npm install -g pm2
pm2 start bot.js --name whatsapp-bot
pm2 save
```

---

## **📌 Next Steps**
- ✅ **Multi-language Support** (Use OpenAI translation)
- ✅ **Analytics Dashboard** (Track chatbot performance)
- ✅ **Webhook Event Logging** (Monitor responses)

---

## **👨‍💻 Contributing**
Feel free to **fork, modify, and submit PRs**! Let's build smarter chatbots together. 🎉  

---
🚀 **Built with ❤️ using OpenAI, Twilio & Pinecone.** 🚀

