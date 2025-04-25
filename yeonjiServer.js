// 📁 yeonjiServer.js

import express from "express";
import { OpenAI } from "openai";
import { config } from "dotenv";
import { transformToEBI } from "./ebi.js"; // EBI 기능 분리 시
import { saveMessage } from "./saveMessage.js";
import { generateCMP } from "./gpt/cmp.js";
import { getYeonjiPrompt } from "./gpt/cp/yeonji.js";
import supabase from "./supabase.js";

config();

const app = express();
const PORT = process.env.PORT || 3100; // 연지용 포트는 다르게

app.use(express.json({ limit: "1mb" }));

let messages = [];
let userFacts = [];
let recentEvents = [];

// ✅ 데이터 로딩 (사건, 사실)
(async () => {
  const { data: messageData } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", "default-user")
    .order("timestamp", { ascending: false })
    .limit(200);

  messages = messageData?.map(m => ({
    role: m.role,
    content: m.message,
    timestamp: new Date(m.timestamp).getTime()
  })) || [];

  const { data: factData } = await supabase
    .from("user_fact_log")
    .select("content")
    .eq("user_id", "default-user");

  userFacts = factData?.map(f => f.content) || [];

  const { data: eventData } = await supabase
    .from("event_log")
    .select("event")
    .eq("user_id", "default-user")
    .order("created_at", { ascending: false })
    .limit(5);

  recentEvents = eventData?.map(e => e.event) || [];

  console.log("✅ [연지] 초기 데이터 로딩 완료");
})();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const timestamp = Date.now();
    messages.push({ role: "user", content: userMessage, timestamp });
    console.log("🟢 [연지] 입력:", userMessage);
    await saveMessage("default-user", "user", userMessage);

    const processedMessage = transformToEBI(userMessage);
    const cmp = generateCMP({ recentEvents, messages, userFacts });
    const yeonjiPrompt = getYeonjiPrompt();

    const chatHistory = [
      yeonjiPrompt,
      ...cmp,
      { role: "user", content: processedMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatHistory,
      temperature: 0.9
    });

    const reply = completion.choices[0].message.content;
    messages.push({ role: "assistant", content: reply, timestamp: Date.now() });
    await saveMessage("default-user", "assistant", reply);

    console.log("💬 [연지] 응답:", reply);
    res.json({ reply });
  } catch (error) {
    console.error("❌ [연지] GPT 오류:", error);
    res.status(500).json({ reply: "[연지] 서버 오류가 발생했어요." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [연지] 서버 실행 중: http://localhost:${PORT}`);
});
