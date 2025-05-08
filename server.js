import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { saveMessage } from "./saveMessage.js";
import supabase from "./supabase.js";
import { getRecentUnifiedMessages } from "./supabase.js";
import { generateCMP } from "./gpt/cmp.js";
import { getJieunPrompt } from "./gpt/cp/jieun.js";
import { getYeonjiPrompt } from "./gpt/cp/yeonji.js";
import { handleEbiPlus } from "./ebi-flow.js"; // 우리가 만든 흐름


config();
const MODEL_MAP = {
  //main_gpt: "deepseek/deepseek-chat",
  main_gpt: "deepseek/deepseek-chat-v3-0324",
  //main_gpt: "meta-llama/llama-4-maverick:CentML",    // 실제 대화 모델
  summary: "gpt-4o",                      // 요약, fact, event 용
  fact_gpt: "gpt-4o",
  event_gpt: "gpt-4o"
};

const PROVIDER_MAP = {
  main_gpt: "openrouter",
  summary: "openai",
  fact_gpt: "openai",
  event_gpt: "openai"
};

const BASE_URL_MAP = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions"
};

const API_KEY_MAP = {
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY
};

const sensitiveWords = ["기억할게요", "⚠️", "요약 기억"]; // 감정이나 시스템 메시지 제외용
const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let messages = [];
let lastMessageTime = null;
let userFacts = [];
let recentEvents = [];

async function callGpt({ task = "main", messages, temperature = 0.9 }) {
  const provider = PROVIDER_MAP[task];
  const baseUrl = BASE_URL_MAP[provider];
  const apiKey = API_KEY_MAP[provider];
  const model = MODEL_MAP[task];

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  });

  const data = await res.json();
  if (data.usage) {
    console.log(`🔢 [${task}] Token usage:`, data.usage);
  } else {
    console.warn(`⚠️ [${task}] usage 정보 없음. 응답 데이터:`, data);
  }
  return data.choices?.[0]?.message?.content || "⚠️ 응답 없음";
}








// ✅ 서버 시작 시 메시지 + 기억 로드
(async () => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", "default-user")
    .order("timestamp", { ascending: false })
    .limit(200);

  if (error) {
    console.error("💥 Supabase 메시지 불러오기 실패:", error.message);
  } else if (data) {
    messages = data
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((m) => ({
        role: m.role,
        content: m.message, 
        timestamp: new Date(m.timestamp).getTime()
      }));

    console.log("✅ Supabase에서 최신 대화 불러옴:", messages.length, "줄");
  }

  // ✅ 사실 불러오기
  const { data: factData, error: factError } = await supabase
    .from("user_fact_log")
    .select("content")
    .eq("user_id", "default-user");

  if (factError) {
    console.error("❌ user_fact_log 불러오기 오류:", factError.message);
  } else {
    userFacts = factData.map(f => f.content);
    console.log("🧠 불러온 사실 목록:", userFacts);
  }

  // ✅ 사건 불러오기
  const { data: eventData, error: eventError } = await supabase
    .from("event_log")
    .select("event")
    .eq("user_id", "default-user")
    .order("created_at", { ascending: false })
    .limit(5);

  if (eventError) {
    console.error("❌ event_log 불러오기 실패:", eventError.message);
  } else {
    recentEvents = eventData.map(e => e.event);  // ✅ 여기! 전역 변수로 반드시 저장해야 함
    console.log("🗓️ 불러온 최근 사건 목록:", recentEvents);
  }



 
})();

app.post("/ebi-process", async (req, res) => {
  console.log("🔥 [EBI] handleEbiPlus 호출됨");  // ✅ 추가!
  const msg = req.body.message;
  if (msg.startsWith("1 ")) {
    const result = await handleEbiPlus(msg);
    res.json({ reply: result });
  } else {
    res.status(400).json({ error: "EBI+ 트리거가 없습니다." });
  }
});

app.post("/chat", async (req, res) => {
  try {
    // ✅ 여기 ↓ 이 줄들로 교체
    const userMessage = req.body.message;
    const isEbi = req.body.isEbi || false;
    const character = req.body.character || "jieun";
    const nsfwModel = req.body.selectedNsfwModel || null; // ✅ 사용자가 선택한 NSFW 모델

    if (isEbi) {
      console.log("🔥 EBI 모드로 처리됩니다");
      const cmp = generateCMP({ recentEvents, messages, userFacts });  // ✅ 먼저 선언
      const reply = await handleEbiPlus(userMessage, "default-user", character, cmp, nsfwModel);  // ✅ 그다음 사용
      await saveMessage("default-user", "assistant", reply, character);
      return res.json({ reply });
    }
    

    const timestamp = Date.now();
    messages.push({ role: "user", content: userMessage, timestamp });
    console.log("🟢 사용자 메시지 저장 시도:", userMessage);
    await saveMessage("default-user", "user", userMessage, null); // 캐릭터 없이 저장
   

    lastMessageTime = timestamp;

    const processedMessage = userMessage;

    const cmp = generateCMP({ recentEvents, messages, userFacts });
    const charPrompt = character === "yeonji" ? getYeonjiPrompt() : getJieunPrompt();


    let recentMessages = await getRecentUnifiedMessages("default-user", 6);
    recentMessages = recentMessages
      .filter(m => !sensitiveWords.some(w => m.message.includes(w)))
      .slice(-6);
    
    recentMessages.forEach((m, i) => {
      console.log(`📨 [지은] 최근 대화 ${i + 1}: ${m.role} ${m.message}`);
    });

    const contextAnalysis = {
      role: "system",
      content:
        "다음은 최근 대화 흐름이야. 감정, 질투, 연지 언급 등을 참고해서 자연스럽게 반응해줘:\n" +
        recentMessages.map((m) => `- ${m.role}: ${m.message}`).join("\n")
    };

    const chatHistory = [
      charPrompt,              // ✅ 아까 만든 캐릭터별 프롬프트
      contextAnalysis,
      ...cmp,
      { role: "user", content: processedMessage }
    ];
    
    

    console.log("📤 chatHistory 길이:", chatHistory.length);

    const reply = await callGpt({ task: "main_gpt", messages: chatHistory, temperature: 0.9, stream: true });

    messages.push({ role: "assistant", content: reply, timestamp: Date.now() });
    await saveMessage("default-user", "assistant", reply, character); 

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
      .order("timestamp", { ascending: false })   // 🔥 최신순으로
      .limit(40);                                // 🔥 최근 20개만 가져오기

    if (error) {
      console.error("💥 Supabase 메시지 불러오기 실패 (/load):", error.message);
      return res.status(500).json({ messages: [], summary: "" });
    }

    const loadedMessages = data
      .map((m) => ({
        role: m.role,
        content: m.message,
        character: m.character === "user" ? null : (m.character || null),
        timestamp: new Date(m.timestamp).getTime(),
      }))
      .reverse(); // 🔥 최신순으로 불러왔으니까 다시 옛날순으로 뒤집어줘야 대화가 자연스럽게 나옴

    res.json({ messages: loadedMessages });
  } catch (err) {
    console.error("💥 /load 처리 중 오류:", err.message);
    res.status(500).json({ messages: [], summary: "" });
  }
});


app.post("/save-memory", async (req, res) => {
  try {
    const { messages } = req.body;
    console.log("💾 기억 저장 요청 수신됨");

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 배열이 필요해요." });
    }

    const userMessagesOnly = messages
      .filter((m) => m.role === "user" && m.content.length > 1)
      .slice(-20)
      .filter((m) => m.content !== "지은이 러프시려우");

    // 사실 추출
    const factPrompt = [
      {
        role: "system",
        content: `다음 문장들 중에서 '객관적인 사실(fact)'만 추출해줘.

✅ 포함해야 할 예시:
- 신상 정보 (예: "1983년생")
- 기기/자산 보유 (예: "포르자300 보유", "자동차=벨로스터")
- 가족, 친구, 연인 상태 (예: "현재 여자친구=다은")

❌ 다음 항목은 모두 제외해:
- 감정 (예: "기분이 좋았다", "외로웠다")
- 사건 (예: "찜질방에 갔다", "데이트했다")
- 행동 묘사 (예: "혼자 울었다", "캠핑 준비했다")

⚠️ 응답은 반드시 JSON 배열 형식으로만 해줘. 설명, 마크다운, 주석 모두 쓰지 마.
예시: ["1983년생", "포르자300 보유", "현재 여친=다은"]

각 문장은 명사 위주로 최대 15자 내외로, 중복 없이 간결하게 작성해줘`
      },
      {
        role: "user",
        content: userMessagesOnly.map((m) => `- ${m.content}`).join("\n")
      }
    ];

    const factReply = await callGpt({ task: "fact_gpt", messages: factPrompt, temperature: 0.6 });
    let finalFacts = [];

    try {
      const facts = JSON.parse(factReply);
      const { data: dbFacts } = await supabase
        .from("user_fact_log")
        .select("content")
        .eq("user_id", "default-user");

      const existingKeywords = new Set();
      dbFacts?.forEach(f => {
        f.content.split(/\s|=|,/).forEach(word => existingKeywords.add(word));
      });

      const newFacts = facts.filter(fact => {
        const words = fact.split(/\s|=|,/);
        return !words.some(word => existingKeywords.has(word));
      });

      const internalCheck = new Set();
      for (const fact of newFacts) {
        const words = fact.split(/\s|=|,/);
        if (!words.some(w => internalCheck.has(w))) {
          finalFacts.push(fact);
          words.forEach(w => internalCheck.add(w));
        }
      }

      for (const fact of finalFacts) {
        await supabase.from("user_fact_log").insert({
          user_id: "default-user",
          content: fact,
          created_at: new Date().toISOString()
        });
      }

      console.log("📦 최종 저장된 사실:", finalFacts);
    } catch (err) {
      console.error("❌ fact 추출 또는 저장 오류:", err.message);
    }

    // 사건 추출
    const eventPrompt = [
      {
        role: "system",
        content: `
다음 대화를 참고하여 최근 발생한 사건이나 활동을 간단히 뽑아줘.
"감정"이나 "사실"이 아닌, 실제 행동이나 상황 중심으로.

예시:
- 찜질방 방문
- 모캠 준비
- 여자친구와 전화

조건:
- 최대 5개 이하
- 15자 이내 문장으로
- JSON 배열로 출력 (마크다운 없이!)
        `.trim()
      },
      {
        role: "user",
        content: userMessagesOnly.map(m => `- ${m.content}`).join("\n")
      }
    ];

    const eventReply = await callGpt({ task: "event_gpt", messages: eventPrompt, temperature: 0.7 });
    let newEvents = [];

    try {
      newEvents = JSON.parse(eventReply);
    } catch (e) {
      console.error("❌ 사건 JSON 파싱 실패:", e.message);
    }

    const { data: existingEvents } = await supabase
      .from("event_log")
      .select("event")
      .eq("user_id", "default-user")
      .order("created_at", { ascending: false })
      .limit(5);

    const existingEventList = existingEvents?.map(e => e.event) || [];
    const dedupedEvents = newEvents.filter(e => !existingEventList.includes(e));

    for (const event of dedupedEvents) {
      await supabase.from("event_log").insert({
        user_id: "default-user",
        event,
        created_at: new Date().toISOString()
      });
    }

    console.log("📌 저장된 사건:", dedupedEvents);
    res.json({ message: "기억 완료!" });

  } catch (err) {
    console.error("❌ /save-memory 최상위 오류:", err.message);
    res.status(500).json({ error: "기억 저장 실패" });
  }
});

app.post("/chat/yeonji", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const timestamp = Date.now();
    messages.push({ role: "user", content: userMessage, timestamp });
    console.log("🟢 [연지] 사용자 메시지 저장 시도:", userMessage);
    await saveMessage("default-user", "user", userMessage, null); // 캐릭터 없이 저장
    

    // ✅ 연지 캐릭터로 사용자 메시지도 저장
    await saveMessage("default-user", "user", userMessage);


    const processedMessage = userMessage;


    // CMP 불러오기 (공통 프롬프트)
    const cmp = generateCMP({ recentEvents, messages, userFacts });

    // 연지 캐릭터 프롬프트 생성
    const yeonjiPrompt = getYeonjiPrompt();
    console.log("🧾 연지 CP 불러옴");

    // 최근 대화 분석 후 감정 유도 설정
    // 연지용 예시
    let recentMessages = await getRecentUnifiedMessages("default-user", 6);
    recentMessages = recentMessages
      .filter(m => !sensitiveWords.some(w => m.message.includes(w)))
      .slice(-6);
    

    recentMessages.forEach((m, i) => {
      console.log(`📨 최근 대화 ${i + 1}: ${m.role} ${m.content}`);
    });

    const contextAnalysis = {
      role: "system",
      content:
        "다음은 최근 대화 흐름이야. 지은 언급, 질투, 오빠 행동 등을 참고해서 자연스럽게 반응해줘:\n" +
        recentMessages.map((m) => `- ${m.role}: ${m.message}`).join("\n")
    };

    const chatHistory = [
      getYeonjiPrompt(),
      contextAnalysis,
      ...cmp,
      { role: "user", content: processedMessage }
    ];
    

    console.log("📤 [연지] chatHistory 길이:", chatHistory.length);

    const reply = await callGpt({ task: "main_gpt", messages: chatHistory, temperature: 0.9 });

    messages.push({ role: "assistant", content: reply, timestamp: Date.now() });
    await saveMessage("default-user", "assistant", reply, "yeonji");

    res.json({ reply });
  } catch (error) {
    console.error("❌ [연지] GPT 응답 오류:", error);
    res.status(500).json({ reply: "[연지] 서버 오류가 발생했어요." });
  }
});


// 마지막 줄
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
