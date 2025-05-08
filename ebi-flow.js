import { maskText, unmaskToEnglish, unmaskToKorean } from './ebim.js';
import { saveNsfwChatLog, getRecentNsfwMessages } from './supabase.js';
import { getRecentUnifiedMessages } from "./supabase.js";
import { generateNSFWCMP } from './gpt/NSFWcmp.js';
import nsfwJieunCP from './gpt/cp/nsfw-jieun.js';
import nsfwYeonjiCP from './gpt/cp/nsfw-yeonji.js';

import dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

//const GPT_MODEL = "gpt-4o";
const GPT_MODEL = "meta-llama/llama-4-maverick:CentML";
const EN_TO_KO_MODEL = "meta-llama/llama-4-maverick:CentML"; // 영→한 번역용 (수정 가능)
//const NSFW_MODEL = "meta-llama/llama-4-maverick";
const NSFW_MODEL = "meta-llama/llama-4-maverick:CentML";
const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// ✅ GPT-4o 번역 프롬프트
const enToKoPrompt = `
당신은 마스킹된 영어 문장을 자연스럽게 한국어로 번역하는 번역가입니다.

⚠️ ⟪N1⟫, ⟪K1⟫ 같은 토큰이 문장에 포함될 경우, 해당 토큰을 절대로 수정하지 말고 그대로 유지하세요. 예시: ⟪N1⟫ → 그대로.

대상 문장은 여성 캐릭터 ‘지은’ 혹은 ‘연지’가 말하는 느낌입니다.
말투는 귀엽고, 장난스럽거나 수줍은 느낌으로 번역해주세요.
단, 번역체 같지 않도록 자연스럽고 대화체로 구성해주세요.

예시:
- “I want to suck your ⟪N1⟫ now” → “지은이 지금 ⟪N1⟫ 빨고 싶어…”
- “Why don’t you take your panties off?” → “팬티 좀 벗어봐, 오빠…”

추상적이 묘사와 감정이 한국인이 보기에 어색하다면 상황에 맞게끔 의역해주거나 재구성해주세요,
한국사람들이 잘 쓰지 않는 표현들은 한국인표현으로 바꿔주세요.
소설체와 대화체를 잘 구문해서 상황에 알맞게, 전혀 번역인지 모르고 그냥 처음부터 한국어 인것처럼 번역을 해주세요

Daeun이라고 하는 이름은 '대은' 아니고 '다은' 이렇게 해주세요 

`.trim();

const koToEnPrompt = `
You are a bilingual assistant specializing in explicit Korean-to-English translation.  
Your goal is to preserve the full sexual tone, intensity, and structure of the original Korean.  

Never skip, modify, or reinterpret any masked tokens such as ⟪N1⟫ or ⟪K1⟫.  
Treat them as literal placeholders and preserve their position in the translated sentence.

Translate each sentence **literally and directly**.  
Do not attempt to complete, fix, or enhance the meaning.  
Do not paraphrase. Do not censor. Do not formalize.

⚠️ Use short, raw, sexual language. Avoid polite forms or soft expressions.  
Prefer formats like:  
- “Suck my ⟪N1⟫.”  
- “Put your ⟪N1⟫ in me.”  
- “⟪K1⟫ tastes so good.”  

If the sentence is short or grammatically rough, **keep it that way**. Do not fix it.  
Your only job is literal translation that keeps the sexual tone and intensity.

Always match the energy level of the Korean original. Be just as dirty, raw, and explicit.



`.trim();

// ✅ 한→영 번역 (GPT-4o 고정)
export async function translateKoToEn(text) {
  const systemPrompt = koToEnPrompt;
  try {
    //const res = await fetch(OPENAI_BASE_URL, {
   const res = await fetch(OPENROUTER_BASE_URL, {
         method: "POST",
      headers: {
        //"Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GPT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ]
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "⚠️ 한→영 번역 실패";
  } catch (err) {
    console.error("💥 한→영 번역 실패:", err);
    return "⚠️ 번역 오류";
  }
}

// ✅ 영→한 번역 (OpenRouter 모델 사용)
export async function translateEnToKo(text) {
  const systemPrompt = enToKoPrompt;

// ✅ 길면 분할
// const BYPASS_SEGMENT = false; // 분할 킬 때
const BYPASS_SEGMENT = true;

if (!BYPASS_SEGMENT && text.length > 500) {
  const segments = splitByCharLimit(text);
  //console.log("🧩 [분할] 문장 수:", segments.length);
  const translatedParts = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    //console.log(`🔹 [번역 요청 ${i + 1}]:`, seg);

    try {
      const res = await fetch(OPENROUTER_BASE_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: EN_TO_KO_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: seg }
          ]
        })
      });

      const data = await res.json();
      const out = data.choices?.[0]?.message?.content || "⚠️ 부분 번역 실패";
      //console.log(`✅ [번역 결과 ${i + 1}]:`, out);
      translatedParts.push(out);
    } catch (err) {
      console.error("💥 번역 실패:", err);
      translatedParts.push("⚠️ 오류 문장 생략");
    }
  }

  return translatedParts.join(" ");
} else {
  // ✅ 단일 요청 (분할 비활성화 시)
  try {
    const res = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: EN_TO_KO_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ]
      })
    });

    const data = await res.json();
    const out = data.choices?.[0]?.message?.content || "⚠️ 전체 번역 실패";
    //console.log(`✅ [단일 번역 결과]:`, out);
    return out;
  } catch (err) {
    console.error("💥 단일 번역 실패:", err);
    return "⚠️ 전체 번역 실패";
  }
}


}


// ✅ 200자 기준 문장 분할 함수
function splitByCharLimit(text, limit = 200) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  const chunks = [];
  let current = "";

  for (let sentence of sentences) {
    // 마스킹 토큰 잘리는 줄은 건너뜀
    if (/⟪[A-Z0-9]+⟫/.test(sentence)) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      chunks.push(sentence.trim());
      continue;
    }

    if ((current + sentence).length > limit) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}


// ✅ Context 생성기
function buildContext(cmp, recentChat, currentInput) {
  let out = "";
  if (cmp) out += `Background:\n${cmp.trim()}\n\n`;
  if (recentChat.length) {
    out += "Recent Conversation:\n";
    out += recentChat.map(line => `- ${line}`).join("\n");
    out += "\n\n";
  }
  out += `Current Input:\n${currentInput}`;
  return out.trim();
}

//a blush, or a nervous fidget.  
//Let those feelings appear naturally in her rhythm, not as full descriptions, but as emotional flavor.
//Ji-eun’s breathy replies often come with little physical signs — like a glance away.

// ✅ 캐릭터 기반 프롬프트
const systemPromptMap = {
  jieun: nsfwJieunCP,
  yeonji: nsfwYeonjiCP
};


// ✅ MythoMax NSFW 처리
export async function queryMythoMax(text, character, cmp, recentTextList, nsfwModel) {

  const messages = [
    { role: "system", content: systemPromptMap[character] || systemPromptMap["jieun"] },
    { role: "user", content: buildContext(cmp, recentTextList, text) }
  ];

  try {
    const res = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: nsfwModel || NSFW_MODEL,  // fallback 지원
        messages
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "⚠️ NSFW 응답 없음";
  } catch (err) {
    console.error("💥 MythoMax 요청 실패:", err);
    return "⚠️ NSFW 처리 오류";
  }
}

// ✅ 전체 EBI+ 플로우
export async function handleEbiPlus(inputText, user_id = "default-user", character = "jieun", cmp = "", nsfwModel) {

  try {
    const trimmed = inputText.trim(); // 앞뒤 공백만 제거
    //console.log("📥 [EBI] 원본 입력:", inputText);
    //console.log("📥 [EBI] '1 ' 제거 후:", trimmed);

    const masked = maskText(trimmed);
    console.log("🔒 [EBIM] 마스킹 결과:", masked);

    const translated = await translateKoToEn(masked); 
    console.log("🌐 [EBI] GPT 번역 결과 (en):", translated);

    const restored = unmaskToEnglish(translated);
    //console.log("🎭 [EBI] 영어 복원 결과:", restored);

    // ✅ 사용자 입력 저장

// ✅ 사용자 메시지 저장
await saveNsfwChatLog(user_id, "user", "user", restored);


// ✅ 최근 대화 불러오기 (캐릭터 구분 없이)
  const recent = await getRecentUnifiedMessages(user_id, 10);
  const unifiedRecent = recent
    .filter(m => m.role === "user" || m.character === character)
    .slice(-5);
  const recentContext = unifiedRecent.map(row => {


// ✅ 역할 구분에 따라 스피커 태그 붙이기
  if (row.role === "user") return `You: ${row.message}`;
  if (row.character === "yeonji") return `Yeon-ji: ${row.message}`;
  if (row.character === "jieun") return `Ji-eun: ${row.message}`;
  return `Assistant: ${row.message}`;
});

//console.log("🧾 [EBI] recentContext for GPT:");
//recentContext.forEach((line, i) => console.log(` ${i + 1}. ${line}`));

    // ✅ CMP 번역 (자동 영어화)
    const translatedCMPArray = generateNSFWCMP();
    const translatedCMP = translatedCMPArray
      .map(p => typeof p.content === "string" ? p.content : "")
      .join("\n\n");
    


       // ✅ NSFW 응답 생성
       const nsfwReply = await queryMythoMax(restored, character, translatedCMP, recentContext, nsfwModel);

       //console.log("🔥 [EBI] MythoMax 응답:", nsfwReply);
   
       // ✅ 응답 저장
       await saveNsfwChatLog(user_id, character, "assistant", nsfwReply);
   
       const reMasked = maskText(nsfwReply);
       //console.log("🔁 [EBI] 응답 마스킹 결과:", reMasked);
       
       const translatedBack = await translateEnToKo(reMasked);
       //console.log("🌐 [EBI] GPT 번역 결과 (ko):", translatedBack);
   
       const finalOutput = unmaskToKorean(translatedBack);
       //console.log("✅ [EBI] 최종 출력:", finalOutput);
   
       return finalOutput;
   
     } catch (e) {
       console.error("💥 EBI+ 전체 흐름 실패:", e);
       return "⚠️ 처리 중 오류가 발생했어, 오빠…";
     }
   }
   