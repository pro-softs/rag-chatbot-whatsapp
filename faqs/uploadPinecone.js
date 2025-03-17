require("dotenv").config();
const { OpenAI } = require('openai');
const { Pinecone } = require("@pinecone-database/pinecone");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

// Load FAQs
const faqs = JSON.parse(fs.readFileSync(path.join(__dirname, "faqs.json"), "utf-8"));

(async () => {
  for (let i = 0; i < faqs.length; i++) {
    // Generate embedding for the question
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: faqs[i].question,
    });

    // Store in Pinecone
    await index.upsert([
      {
        id: `faq-${i}`,
        values: embedding.data[0].embedding,
        metadata: { answer: faqs[i].answer, question: faqs[i].question },
      },
    ]);
  }

  console.log("✅ FAQs stored in Pinecone successfully!");
})();
