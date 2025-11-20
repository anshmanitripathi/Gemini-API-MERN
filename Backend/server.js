const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require("@google/genai");
const fs = require('fs');
require('dotenv').config();

const pdfParse = require('pdf-extraction');

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 5000;

//CONFIGURATION
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-chatbot";
const GEN_AI_KEY = process.env.GEMINI_API_KEY;

if (!GEN_AI_KEY) {
  console.error("CRITICAL ERROR: GEMINI_API_KEY is missing in .env file");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// HEALTH CHECK ROUTE
app.get('/', (req, res) => {
  res.send('API is running successfully!');
});

//MONGODB SETUP
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Error:", err));

const ChatSchema = new mongoose.Schema({
  userId: String,
  title: String,
  createdAt: { type: Date, default: Date.now }
});
const MessageSchema = new mongoose.Schema({
  chatId: String,
  role: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', ChatSchema);
const Message = mongoose.model('Message', MessageSchema);

//AI SETUp
const ai = new GoogleGenAI({ apiKey: GEN_AI_KEY });

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro"
];

async function generateContent(prompt) {
  let lastError = null;
  
  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`Trying model: ${modelName}...`);
      
      // NEW SDK SYNTAX
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt, // The new SDK accepts simple strings here
      });

      // Handle the response object from the new SDK
      if (response && response.text) {
        return response.text;
      } else if (response && typeof response.text === 'function') {
        return response.text();
      } else {
         throw new Error("Empty response from AI");
      }
      
    } catch (error) {
      console.warn(`Model '${modelName}' failed. Trying next...`);
      lastError = error;
    }
  }
  
  throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
}

// --- ROUTES ---

app.get('/api/chats/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chats', async (req, res) => {
  try {
    const newChat = new Chat({ userId: req.body.userId, title: "New Conversation" });
    await newChat.save();
    res.json(newChat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/chats/:id', async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ chatId: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// MESSAGE ENDPOINT
app.post('/api/message', upload.single('pdf'), async (req, res) => {
  const { chatId, content, userId } = req.body;
  
  try {
    let finalChatId = chatId;
    if (!finalChatId) {
      const newChat = new Chat({ userId, title: content.substring(0, 30) + "..." });
      await newChat.save();
      finalChatId = newChat._id;
    }

    let userContent = content;
    if (req.file) userContent += ` [File: ${req.file.originalname}]`;
    
    const userMsg = new Message({ chatId: finalChatId, role: 'user', content: userContent });
    await userMsg.save();

    let prompt = content;
    if (req.file) {
      const buffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(buffer);
      prompt = `Context from PDF:\n${data.text}\n\nUser Question:\n${content}`;
      fs.unlinkSync(req.file.path);
    }

    // Use the new generator function
    const aiText = await generateContent(prompt);

    const aiMsg = new Message({ chatId: finalChatId, role: 'model', content: aiText });
    await aiMsg.save();

    res.json({ chatId: finalChatId, userMessage: userMsg, aiMessage: aiMsg });

  } catch (err) {
    console.error("Processing Error:", err);
    res.status(500).json({ 
      error: "Server Error: " + (err.message || "Unknown error")
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));