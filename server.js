
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

config();
const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let messages = [];
let lastMessageTime = null;
let summary = "";

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const timestamp = Date.now();
    messages.push({ role: "user", content: userMessage, timestamp });
    lastMessageTime = timestamp;

    const systemPrompt = summary ? 
      { role: "system", content: "다음은 이전 대화 요약입니다: " + summary } : null;

    const chatHistory = [
      ...(systemPrompt ? [systemPrompt] : []),
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatHistory
    });

    const reply = completion.choices[0].message.content;
    messages.push({ role: "assistant", content: reply, timestamp: Date.now() });
    res.json({ reply });
  } catch (error) {
    console.error("GPT 응답 오류:", error);
    res.status(500).json({ reply: "서버 오류가 발생했어요." });
  }
});

app.get("/load", (req, res) => {
  res.json({ messages, summary });
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  // 1시간 경과 요약 체크
  setInterval(async () => {
    if (!lastMessageTime || Date.now() - lastMessageTime < 3600000 || messages.length < 8) return;
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "다음 대화를 간단히 요약해줘. 감정의 흐름 위주로 부탁해." },
          ...history
        ]
      });
      summary = response.choices[0].message.content;
      console.log("요약 저장됨:", summary);
    } catch (e) {
      console.error("요약 실패:", e.message);
    }
  }, 60000);
});
