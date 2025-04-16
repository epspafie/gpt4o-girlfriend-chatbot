const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");

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
    chatBox.lastChild.remove(); // remove "..."
    addMessage(data.reply, "gpt");
  } catch (err) {
    chatBox.lastChild.remove();
    addMessage("⚠️ GPT 응답 오류", "gpt");
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/load");
  const data = await res.json();

  if (data.summary) {
    addMessage("[요약 기억] " + data.summary, "gpt");
  }

  data.messages.forEach((m) => {
    addMessage(m.content, m.role === "user" ? "user" : "gpt");
  });
});
