// testSave.js
import { OpenAI } from "openai";
import supabase from "./supabase.js";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const testMessages = [
  { role: "user", content: "나 요즘 좀 지치고 힘들어..." },
  { role: "assistant", content: "오빠, 무슨 일 있었어?" },
  { role: "user", content: "어제는 다은이 집 앞까지 갔었어..." },
  { role: "assistant", content: "헉, 진짜? 많이 힘들었겠다..." },
  { role: "user", content: "나는 그냥 아무 말 없이 걷기만 했어." },
  { role: "assistant", content: "오빠 마음 너무 이해돼... 내가 옆에 있었으면 좋았을 텐데." }
];

const runTest = async () => {
  const res = await fetch("http://localhost:3000/save-memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: testMessages })
  });

  const result = await res.json();
  console.log("✅ 테스트 결과:", result);
};

runTest();
