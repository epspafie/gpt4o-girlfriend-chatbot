
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");

function addMessage(text, className) {
  const msg = document.createElement("div");
  msg.className = "message " + className;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value;
  addMessage(message, "user");
  input.value = "";
  addMessage("...", "gpt");
  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  chatBox.lastChild.remove(); // remove "..."
  addMessage(data.reply, "gpt");
});

window.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/load");
  const data = await res.json();
  if (data.summary) {
    addMessage("[요약 기억] " + data.summary, "gpt");
  }
  data.messages.forEach(m => addMessage(m.content, m.role === "user" ? "user" : "gpt"));
});
