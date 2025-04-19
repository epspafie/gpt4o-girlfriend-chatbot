const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const voiceToggle = document.getElementById("voice-toggle");
let voiceEnabled = false;

// 음성 읽기 함수 (삼성 TTS 사용)
function speak(text) {
  if (!voiceEnabled) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ko-KR";
  utter.voice = speechSynthesis.getVoices().find(v => v.name.includes("Samsung") && v.name.includes("Female")) || null;
  utter.pitch = 1.1;
  utter.rate = 1.05;
  speechSynthesis.speak(utter);
}

voiceToggle.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  voiceToggle.textContent = voiceEnabled ? "음성 ON 🔊" : "음성 OFF 🔇";
});

function addMessage(text, role) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);

  // GPT만 프로필 이미지 추가
  if (role === "gpt") {
    const avatar = document.createElement("img");
    avatar.src = "gpt-profile.png";
    avatar.alt = "GPT";
    avatar.classList.add("avatar");
    msg.appendChild(avatar);
  }

  // 말풍선 생성
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.textContent = text;
  msg.appendChild(bubble);

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (role === "gpt") speak(text);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  addMessage("...", "gpt");

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    chatBox.lastChild.remove();
    addMessage(data.reply, "gpt");
  } catch (err) {
    chatBox.lastChild.remove();
    addMessage("⚠️ GPT 응답 오류", "gpt");
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/load");
  const data = await res.json();

  // 기존 말풍선 제거 방지용 안전 조치 (의심되는 다른 렌더링 충돌 방지)
  setTimeout(() => {
    data.messages.forEach((m) => {
      const role = m.role === "user" ? "user" : "gpt";
      addMessage(m.content, role);
    });

    if (data.summary) {
      addMessage("[요약 기억] " + data.summary, "gpt");
    }
  }, 50); // 50ms 지연으로 강제 렌더 순서 확보
});
