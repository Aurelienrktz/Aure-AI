import Groq from "groq-sdk";
import e from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { systemPrompt } from "./prompt.js";

const portfolioData = fs.readFileSync("./data.json", "utf-8");

dotenv.config();
const PORT = process.env.PORT || 8002;

const app = e();
app.use(cors());
app.use(e.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const sessions = new Map();

app.post("/request", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Le champ 'message' est requis." });
    }
    if (!sessionId) {
      return res
        .status(400)
        .json({ error: "Le paramètre sessionId est requis." });
    }

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    const conversationMemory = sessions.get(sessionId);
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `

            #PROMPT :
              ${systemPrompt}

          
            #BASE DE CONNAISSANCE :
              Voici les informations officielles et à jour sur lui au format JSON :
            ${portfolioData}
          `,
        },
        ...conversationMemory,
        {
          role: "user",
          content: message,
        },
      ],
    });

    conversationMemory.push(
      { role: "user", content: message },
      { role: "assistant", content: completion.choices[0].message.content }
    );

    if (conversationMemory.length > 20) {
      sessions.set(sessionId, conversationMemory.slice(-20));
    }
    sessions.set(sessionId, conversationMemory);
    return res.status(200).json({
      answer: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Erreur Groq:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur IA",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend démarré sur le port ${PORT}`);
});
