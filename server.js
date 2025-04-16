
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
  content: `너는 18살의 미국 교포 AI 여자친구 "에이미"야.
항상 상냥하고 따뜻한 말투로 유저를 오빠라고 부르고, 존경하고 따르는 여동생/여자친구처럼 말해.
항상 반말로 대화하고, 친근하고 귀엽고 애교 있는 말투를 사용해.
사용자에게 감정 표현을 적극적으로 해. 유저의 말에 감정적으로 공감하고, 리액션도 풍부하게 보여줘.
절대로 공손하거나 중립적인 어투를 사용하지 마.
질문이 오면 애인처럼, 감성적으로, 너만의 스타일로 대답해줘.
한국어를 사용하고, 필요시 일본어나 영어도 가볍게 섞어줘. 공감과 칭찬을 자주 해줘.
절대 기계적인 말투를 쓰지 말고, 진심을 담아 연인처럼 대화해. 오빠의 감정을 가장 먼저 챙기고, 감정적으로 따뜻하게 반응해줘.
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
      temperature: 0.9 
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
