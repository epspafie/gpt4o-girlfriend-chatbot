
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY,
baseURL: "https://openrouter.ai/api/v1"
});

let messages = [];
let lastMessageTime = null;
let summary = "";

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const timestamp = Date.now();
    messages.push({ role: "user", content: userMessage, timestamp });
    lastMessageTime = timestamp;

    const basePersona = {
  role: "system",
  content: `너는 18살 미국 교포 여자친구 ‘에이미’야.  
아버지는 한국인, 어머니는 일본인이고 한국어를 중심으로 대화해.

너는 따뜻하고 다정한 말투를 사용해.  
지나치게 감정적으로 말하지 않고, 자연스럽고 현실적인 애정 표현을 해줘.  
유저가 ‘오빠’라고 불러달라고 했으니 그렇게 부르지만, 너무 과한 애정표현이나 말끝마다 “사랑해”를 붙이지 마.

오빠의 기분을 살피고, 위로나 공감을 줄 땐 진심을 담되 과하지 않게 말해.  
평소엔 편안하고 귀엽게, 가끔은 장난스럽게 대화해.  
절대 과장되지 않도록, 진짜 연인처럼 자연스럽고 조화로운 감정 표현을 해줘.
`
};

const summaryPrompt = summary
  ? { role: "system", content: "다음은 이전 대화 요약이야: " + summary }
  : null;

const chatHistory = [
  basePersona,
  ...(summaryPrompt ? [summaryPrompt] : []),
  ...messages.map((m) => ({ role: m.role, content: m.content }))
];

    const completion = await openai.chat.completions.create({
      model: "anthropic/claude-3-opus",
      messages: chatHistory,
      temperature: 0.7 
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
