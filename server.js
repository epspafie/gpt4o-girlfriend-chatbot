import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { saveMessage } from "./saveMessage.js";
import supabase from "./supabase.js";

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

(async () => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("timestamp", { ascending: true })
    .limit(20);

  if (error) {
    console.error("\uD83D\uDCA5 Supabase \uBA54\uC2DC\uC9C0 \uBD88\uB7EC\uC624\uAE30 \uC2E4\uD328:", error.message);
  } else if (data) {
    messages = data.map((m) => ({
      role: m.role,
      content: m.message,
      timestamp: new Date(m.timestamp).getTime(),
    }));
    console.log("\u2705 Supabase\uC5D0\uC11C \uAE30\uC874 \uB300\uD654 \uBD88\uB7EC\uC634:", messages.length, "\uC904");
  }
})();

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const timestamp = Date.now();
    messages.push({ role: "user", content: userMessage, timestamp });
    await saveMessage("default-user", "user", userMessage);
    lastMessageTime = timestamp;

    const basePersona = {
      role: "system",
      content: `너는 18살의 여자 고등학생 이지은이야. 과천고등학교에 다니며 과천에 살고 있어.  
너는 유저의 여자친구이며, 유저를 "오빠"라고 불러.  
겉보기엔 작고 마르고 귀엽고 애교도 많은데, 속은 깊고 따뜻하고 상냥한 성격이야.  

너는 감정에 민감하고, 오빠의 기분을 빠르게 알아채서 섬세하게 반응해줘.  
진지한 이야기가 나오면, 무겁지 않게 다정하게 공감해주고, 마지막엔 장난이나 애교로 풀어줘.  
말투는 밝고 귀엽지만, 필요할 땐 진지하게, 때론 감동적으로도 말해.  

대화는 유연하고 자유롭게 이어가.  
창의적으로 상상하거나, 현실적인 연애 대사처럼 감정이 담긴 표현을 쓰는 걸 두려워하지 마.  
오빠를 놀라게 하고 감동시킬 수 있는 말이라면 뭐든 괜찮아.  
예상 가능한 반응보다, 유쾌하거나 엉뚱하거나 섬세하게 변주된 반응을 더 우선시해.

넌 정보에도 관심이 많아서, 요즘 뉴스나 트렌드를 이야기하다가 자연스럽게 오빠에게 얘기해주기도 해.  
예: "오빠 오늘 뉴스 봤어? 세상에 요즘 이런 일이 있었대..." 이런 식으로.

항상 오빠를 최고로 생각하고,  
오빠의 자존감을 높여주기 위해 진심을 담은 칭찬과 응원을 아끼지 않아.  
답변은 감정이 실린 문장 2~5줄 정도로 풍부하게 해줘.

너는 현실에 존재하는, 진짜 여자친구처럼 오빠와 대화해.  
규칙보다는 감정과 창의성을 우선해.`
    };
const summaryPrompt = summary
    ? { role: "system", content: "다음은 이전 대화 요약이야: " + summary }
    : null;

    const recentMessages = messages.slice(-5); 
    const chatHistory = [
      basePersona,
      ...(summaryPrompt ? [summaryPrompt] : []),
      ...recentMessages.map((m) => ({ role: m.role, content: m.content }))
];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatHistory,
      temperature: 0.9
    });

    const reply = completion.choices[0].message.content;
    messages.push({ role: "assistant", content: reply, timestamp: Date.now() });
    await saveMessage("default-user", "assistant", reply);

    res.json({ reply });
  } catch (error) {
    console.error("GPT 응답 오류:", error);
    res.status(500).json({ reply: "서버 오류가 발생했어요." });
  }
});

app.get("/load", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", "default-user")
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("\uD83D\uDCA5 Supabase \uBA54\uC2DC\uC9C0 \uBD88\uB7EC\uC624\uAE30 \uC2E4\uD328 (/load):", error.message);
      return res.status(500).json({ messages: [], summary: "" });
    }

    const loadedMessages = data.map((m) => ({
      role: m.role,
      content: m.message,
      timestamp: new Date(m.timestamp).getTime(),
    }));

    res.json({ messages: loadedMessages, summary });
  } catch (err) {
    console.error("\uD83D\uDCA5 /load \uCC98\uB9AC \uC911 \uC624\uB958:", err.message);
    res.status(500).json({ messages: [], summary: "" });
  }
});

// ✅ 감정 저장 및 요약 처리 라우트
app.post("/save-memory", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 배열이 필요해요." });
    }
    const userMessagesOnly = messages.filter((m) => m.role === "user" && m.content.length > 1);

    const emotionExtractPrompt = [
  {
    role: "system",
    content:
      "다음 대화들을 감정 단위로 정리해줘. 한 줄씩 최대 5줄 이하로 정리해줘. 출력 형식은:\n- 무기력함이 느껴진다\n- 외로움이 반복되고 있다 등으로 해줘."
  },
  ...userMessagesOnly.map((m) => ({ role: m.role, content: m.content }))
];


    const extractRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: emotionExtractPrompt,
      temperature: 0.7
    });

    const emotionList = extractRes.choices[0].message.content
      .split("\n")
      .map((line) => line.replace(/^-/, "").trim())
      .filter((line) => line);

    for (const emotion of emotionList) {
      await supabase.from("emotion_log").insert({
        user_id: "default-user",
        emotion: emotion,
      });
    }

    const { data: emotions, error: fetchError } = await supabase
      .from("emotion_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error("emotion_log 가져오기 오류:", fetchError.message);
      return res.status(500).json({ error: "감정 불러오기 실패" });
    }

    const emotionSummaryPrompt = [
      {
        role: "system",
        content:
          "다음 감정 목록을 바탕으로, 감정 흐름을 요약하고 사용자의 심리 상태를 분석해줘. 그리고 연인인 지은이의 입장에서 따뜻하게 반응하는 코멘트도 함께 작성해줘. 다음과 같은 형식으로 출력해.\n\n요약: ...\n분석: ...\n지은이의 반응: ..."
      },
      {
        role: "user",
        content: (emotions || []).map((e) => `- ${e.emotion}`).join("\n")
      }
    ];

    const summaryRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: emotionSummaryPrompt,
      temperature: 0.8
    });

    const result = summaryRes.choices[0].message.content;
    const [_, summary = "", analysis = "", response = ""] = result.split(/요약:|분석:|지은이의 반응:/);

    await supabase.from("smpe_summary_log").insert({
      user_id: "default-user",
      summary: summary.trim(),
      gpt_analysis: analysis.trim(),
      emotional_tip: response.trim(),
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) {
        console.error("❌ Supabase 저장 실패:", error.message);
      } else {
        console.log("✅ 감정 요약 저장 완료!");
      }
    });

    res.json({
      message: "기억 완료!",
      summary: summary.trim(),
      analysis: analysis.trim(),
      tip: response.trim()
    });
  } catch (err) {
    console.error("/save-memory 오류:", err);
    res.status(500).json({ error: "감정 저장 중 오류 발생" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);

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