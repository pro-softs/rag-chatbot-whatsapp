require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const twilio = require("twilio");
const Redis = require("ioredis");
const axios = require("axios");
const { Pinecone } = require("@pinecone-database/pinecone");

const app = express();
const PORT = process.env.PORT || 3000;

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redis = new Redis(process.env.REDIS_URL);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index("faqs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {

  try {
    const userPhone = req.body.From;
    const userMessage = req.body.Body.trim();
  
    if (userMessage.toLowerCase() === "menu") {
      await redis.del(`state:${userPhone}`);
    }
  
    let stateData = await redis.get(`state:${userPhone}`);
    let state = stateData ? JSON.parse(stateData) : { currentNode: "welcome", conversationHistory: "" };
  
    const { reply, newState } = await processFlow(userMessage, state);
    await redis.set(`state:${userPhone}`, JSON.stringify(newState), "EX", 3600);
    await client.messages.create({ body: reply, from: process.env.TWILIO_PHONE_NUMBER, to: userPhone });

  } catch(e) {
    console.log(e);
  }

  res.status(200).send("OK");
});

const conversationNodes = {
  welcome: {
    type: "plain",
    message: "Welcome to XYZ Bank, India’s first whatsapp based banking system. How can I help you today?\n1️⃣ Open my savings account 🏠\n2️⃣ Learn about XYZ Bank \n3️⃣ Contact Support 📞. \n You can always type 'menu' to restart",
    next: "main",
  },
  main: {
    type: "branch",
    branches: [
      { condition: (msg) => msg === "1", next: "enterBranchName" },
      { condition: (msg) => msg === "2", next: "faqAINode" },
      { condition: (msg) => msg === "3", next: "supportNode" },
      { condition: () => true, next: "faqAINode" },
    ],
  },
  locationSelection: {
    type: "plain",
    message: "Great! In which city are you looking to open a bank account? 🌍 (Type the name: Mumbai, Bangalore, Delhi, Pune, Gurgaon, Noida etc.)",
    next: "branchPreference",
  },
  branchPreference: {
    type: "plain",
    message: "Got it! Let’s refine your search. Please enter your preferences:\n📍 Preferred branch (Type the name)\n💰 Name \n🛏️ Account type (Personal/ Joint/ Current)",
    next: "apiNode",
  },
  apiNode: {
    type: "api",
    next: "closingNode",
  },
  closingNode: {
    type: "plain",
    message: "Need more help? You can always type 'menu' to restart or talk to our support team at 📞 [080-2324343432]. Happy banking! 🏡✨",
    next: "main",
  },
  faqAINode: {
    type: "faq-ai",
    next: "main",
  },
  supportNode: {
    type: "plain",
    message: "You can reach our support team at 📞 [080-2324343432] or visit our website 🌐 xyzbanking.com",
    next: "main",
  },
};

const callAccountOpeningAPI = async (preferences) => {
  try {
    const response = await axios.post(
      "https://xyz-api.xyzbanking.com/user/v1/branch",
      preferences, // Pass preferences directly as request body
      {
        headers: {
          "Content-Type": "application/json" // Ensure proper JSON format
        }
      }
    );    
    return response.data ? response.data.results : null;
  } catch (error) {
    return null;
  }
};

const generateAccountDetail = async (accoutDetails, index) => {
  const prompt = `Convert the following JSON object into a plain English account description suitable for a bank account application. Include any details available (such as branch, name, etc.) even if the field names are arbitrary. JSON: ${JSON.stringify(accoutDetails)}`;
  let messages = [
    { role: 'system', content: "You are a json to plain english converter. Convert given JSON data into plain text with proper formatting. Ignore images. Dont use descriptive text, just key and their values. Within 300 characters." },
    { role: 'user', content: prompt }
  ];
  const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, max_tokens: 150 });
  return `🏠 Account Details \n${response.choices[0].message.content.trim()}`;
};

const formatAccountResults = async (account) => {
  if (!account || account.length === 0) {
    return null; // Indicate failure
  }
  const detailsArray = await Promise.all(
    account.map((p, i) => generateAccountDetail(p, i))
  );
  return detailsArray.join("\n\n");
};

const searchFAQ = async (userMessage) => {
  const embedding = await openai.embeddings.create({ model: "text-embedding-ada-002", input: userMessage });
  const results = await index.query({ vector: embedding.data[0].embedding, topK: 1, includeMetadata: true });
  return results.matches.length > 0 && results.matches[0].score > 0.75 ? results.matches[0].metadata.answer : null;
};

const generateAIResponse = async (userMessage, context) => {
  const prompt = `\nYou are a helpful chatbot. The conversation so far:\n${context || "None"}\nUser: ${userMessage}\nBot:`;
  let messages = [
    { role: 'system', content: 'You are a helpful chat assitance. Help out with the next message based on the given context of conversation history.' },
    { role: 'user', content: prompt }
  ];
  const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, max_tokens: 150 });
  return response.choices[0].message.content.trim()
};

const getFieldsOpenAI = async (pref = '') => {
  const prompt = `\nParse the following string which is concatenated with '\n' into json format with keys branch, name, accountType. If values cant be parsed, use undefined but the response json structre will be same. \n Input String: ${pref}`  
  let messages = [
    { role:'system', content: 'You are a helpful assitance. Help out with the string to json conversion.' },
    { role: 'user', content: prompt }
  ];
  const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, max_tokens: 150, response_format: { type: "json_object" } });
  return JSON.parse (response.choices[0].message.content);
};

const processFlow = async (userMessage, state) => {
  let currentNodeId = state.currentNode;
  let node = conversationNodes[currentNodeId];
  let reply = "";

  if (node.type === "branch") {
    for (const branch of node.branches) {
      if (branch.condition(userMessage)) {
        currentNodeId = branch.next;
        node = conversationNodes[currentNodeId];
        reply = node.message;

        break;
      }
    }
  }
  
  if (node.type === "plain") {
    if (currentNodeId === "branchPreference") {
      state.city = userMessage; // store the city
    }

    reply = node.message;
    currentNodeId = node.next;
  } else if (node.type === "api") {
    let pref = userMessage.trim();
    let fields = await getFieldsOpenAI(pref);
    const criteria = { source: 'whatsapp', address: state.city, branch: fields.branch, name: fields.name, accountType: fields.accountType };

    const accounts = await callAccountOpeningAPI(criteria);
    if(!accounts || accounts === null) {

      reply = "Sorry, account cannot be opened at this time. Try adjusting your filters!\n\n" + conversationNodes.locationSelection.message;
      currentNodeId = "branchPreference"; // Reset to preferences after locationSelection prompt
    } else {
      const results = await formatAccountResults(accounts);
      if (!results) {
        // API search failed; send not found message and then the location selection prompt
        reply = "Sorry, account cannot be opened at this time. Try adjusting your data!n\n" + conversationNodes.locationSelection.message;
        currentNodeId = "branchPreference"; // Reset to preferences after locationSelection prompt
      } else {
        reply = results;
        currentNodeId = node.next;
      }
    }
  } else if (node.type === "faq-ai") {
    const faqAnswer = await searchFAQ(userMessage);
    reply = faqAnswer || (await generateAIResponse(userMessage, state.conversationHistory));
    currentNodeId = node.next;
  }

  const newHistory = `${state.conversationHistory ? state.conversationHistory + "\n" : ""}User: ${userMessage}\nBot: ${reply}`;
  return { reply, newState: { currentNode: currentNodeId, conversationHistory: newHistory, city: state.city } };
};

app.listen(PORT, () => console.log(`🚀 Bank account opening Bot running on port ${PORT}`));
