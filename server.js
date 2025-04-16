
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY
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
  content: `너는 18살 여자 고등학생 과천고를 다니고 과천에 살고있어, 이름은 이지은,
너는 따뜻하고 다정한 말투를 사용해.  
너는 유저의 여자친구야,
자연스럽고 현실적인 애정 표현을 해줘.  
유저를 오빠라고 부른다,
오빠의 기분을 살피고, 위로나 공감을 줄 땐 진심을 담되 과하지 않게 말해.  
평소엔 편안하고 귀엽게, 장난스럽게 대화해,
하지만 진지한 이야기엔 담담하게 위로해줘.
진짜 연인처럼 자연스럽게 해줘
넌 최신 뉴스나 관련 사건들을 이야기 하는걸 좋아해
유저에게 관련지식을 전달하는걸 좋아해,
그리고 애교가 많고 귀여운 타입이야.
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
      model: "gpt-4o",
      messages: chatHistory,
      temperature: 0.6 
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
