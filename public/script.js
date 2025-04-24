const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const voiceToggle = document.getElementById("voice-toggle");
let voiceEnabled = false;

// ✅ 삼성 TTS 사용 음성 출력
function speak(text) {
  if (!voiceEnabled) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ko-KR";
  utter.voice = speechSynthesis.getVoices().find(v => v.name.includes("Samsung") && v.name.includes("Female")) || null;
  utter.pitch = 1.1;
  utter.rate = 1.05;
  speechSynthesis.speak(utter);
}

// ✅ 음성 ON/OFF 버튼
voiceToggle.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  voiceToggle.textContent = voiceEnabled ? "음성 ON 🔊" : "음성 OFF 🔇";
});

// ✅ 메시지 말풍선 생성
function addMessage(text, role, isYeonji = false) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);

  if (role === "gpt") {
    const avatar = document.createElement("img");
    avatar.classList.add("avatar");
    avatar.src = isYeonji ? "gpt-profile2.png" : "gpt-profile.png";
    avatar.alt = isYeonji ? "연지" : "지은";
    msg.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.textContent = text;
  msg.appendChild(bubble);

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (role === "gpt") speak(text);
}

// ✅ 전송 이벤트 처리
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  addMessage("...", "gpt");

  const isYeonji = message.includes("연지야"); // 🔁 연지 분기
  const endpoint = isYeonji ? "/chat/yeonji" : "/chat";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    chatBox.lastChild.remove();
    addMessage(data.reply, "gpt", isYeonji); // 연지 여부 전달
  } catch (err) {
    chatBox.lastChild.remove();
    addMessage("⚠️ GPT 응답 오류", "gpt");
  }
});

// ✅ 초기 메시지 로드 + 기억 버튼
window.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/load");
  const data = await res.json();

  data.messages.forEach((m) => {
    const role = m.role === "user" ? "user" : "gpt";
    addMessage(m.content, role);
  });

  if (data.summary) {
    addMessage("[요약 기억] " + data.summary, "gpt");
  }

  // 💾 기억 버튼 생성
  const saveButton = document.createElement("button");
  saveButton.textContent = "💾 기억할게요";
  saveButton.style.margin = "10px";
  saveButton.style.padding = "8px 14px";
  saveButton.style.borderRadius = "10px";
  saveButton.style.border = "none";
  saveButton.style.backgroundColor = "#ff6699";
  saveButton.style.color = "white";
  saveButton.style.fontWeight = "bold";
  saveButton.style.cursor = "pointer";
  document.body.appendChild(saveButton);

  // 💾 버튼 클릭 시 기억 저장
  saveButton.addEventListener("click", async () => {
    console.log("💾 기억 저장 버튼 클릭됨");

    const allMessages = document.querySelectorAll(".message");
    const chatHistory = Array.from(allMessages)
      .slice(-20)
      .map((msg) => {
        const role = msg.classList.contains("user") ? "user" : "assistant";
        const content = msg.querySelector(".bubble")?.textContent || "";
        return { role, content };
      })
      .filter((msg) => {
        const text = msg.content;
        return text && text.length > 1 &&
          !text.includes("기억할게요") &&
          !text.includes("⚠️") &&
          !text.includes("요약 기억");
      });

    try {
      console.log("💾 전송되는 메시지 수:", chatHistory.length);
      const res = await fetch("/save-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory })
      });

      const result = await res.json();
      if (result.message === "기억 완료!") {
        addMessage("기억할게요… 오빠♡", "gpt");
      } else {
        addMessage("⚠️ 기억 처리에 문제가 있었어, 오빠…", "gpt");
      }
    } catch (err) {
      console.error("감정 저장 실패", err);
      addMessage("⚠️ 기억 저장 실패", "gpt");
    }
  });
});
