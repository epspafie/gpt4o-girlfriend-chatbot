const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const voiceToggle = document.getElementById("voice-toggle");
let voiceEnabled = false;
let selectedCharacter = "jieun";

//띄어쓰기 함수
function renderPreservedSpacing(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map(line => `<p>${line}</p>`)
    .join(""); // ✅ <p> 태그로 줄바꿈 처리

  return escaped;
}


// ✅ 삼성 TTS 사용 음성 출력
function speak(text) {
  if (!voiceEnabled) return;
  const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])+/g, "");

  const utter = new SpeechSynthesisUtterance(cleanText);
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
  bubble.innerHTML = renderPreservedSpacing(text);
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

 
  const isEbi = document.getElementById("ebiToggle").checked;
  const endpoint = "/chat";

  console.log("✅ 전송된 endpoint:", endpoint);


  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
     // ✅ 전송 이벤트 처리 내부
body: JSON.stringify({
  message: message,
  isEbi: isEbi,
  character: selectedCharacter,
  selectedNsfwModel: localStorage.getItem("selectedNsfwModel") || "gryphe/mythomax-l2-13b"  // 추가
})

      
    });
    
    //글자 바탕색 처리리
    function highlightQuotedText(text) {
      return text.replace(/"([^"]+)"/g, '<span class="quote">"$1"</span>');
    }
    
    function renderPreservedSpacing(text) {
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      
      return escaped
        .split("\n")
        .map(line => `<p>${highlightQuotedText(line)}</p>`)
        .join("");
    }
    
    const data = await res.json();
    console.log("GPT 응답 내용:\n", JSON.stringify(data.reply));
    chatBox.lastChild.remove();
    if (typeof data.reply === "string") {
      data.reply = data.reply
        .replace(/([.?!])\s/g, "$1\n")              // 문장부호 뒤 줄바꿈
        .replace(/(\*)\s/g, "$1\n")                 // * + 공백 뒤 줄바꿈
        .replace(/(\*)(?=\w|[가-힣])/g, "$1\n");    // * 바로 뒤에 문자 시작되면 줄바꿈
    }
    
      addMessage(data.reply, "gpt", selectedCharacter === "yeonji");

  } catch (err) {
    chatBox.lastChild.remove();
    addMessage("⚠️ GPT 응답 오류", "gpt");
  }
});

// ✅ 초기 메시지 로드 + 기억 버튼
window.addEventListener("DOMContentLoaded", async () => {

    // ✅ NSFW 모델 리스트 로드
    try {
      const res = await fetch("/gpt/NSFWmodelList.json");
      const models = await res.json();
  
      const dropdown = document.getElementById("nsfw-model-dropdown");
      const selectedText = document.getElementById("selected-nsfw-model");
  
      // ✅ 드롭다운 초기화
      dropdown.innerHTML = "";
  
      // ✅ 드롭다운 옵션 채우기
      models.forEach((model, idx) => {
        const option = document.createElement("option");
        option.value = model.key;
        option.textContent = `${model.name} (${model.description})`;
  
        // isDefault가 true이면 선택
        if (model.isDefault) {
          option.selected = true;
          selectedText.textContent = model.name;
          localStorage.setItem("selectedNsfwModel", model.key);
        }
  
        dropdown.appendChild(option);
      });
  
      // ✅ 선택 변경 시 로컬 저장
      dropdown.addEventListener("change", () => {
        const selectedKey = dropdown.value;
        const selectedName = dropdown.options[dropdown.selectedIndex].textContent;
  
        localStorage.setItem("selectedNsfwModel", selectedKey);
        selectedText.textContent = selectedName;
      });
  
      // ✅ 이전에 저장된 값이 있으면 적용
      const savedKey = localStorage.getItem("selectedNsfwModel");
      if (savedKey) {
        const match = [...dropdown.options].find(o => o.value === savedKey);
        if (match) {
          dropdown.value = savedKey;
          selectedText.textContent = match.textContent;
        }
      }
  
      console.log("✅ NSFW 모델 드롭다운 초기화 완료");
    } catch (err) {
      console.error("❌ NSFW 모델 목록 불러오기 실패", err);
    }
  
    // ✅ 캐릭터 선택 이벤트 등록
    document.querySelectorAll(".character-select").forEach(img => {
      img.addEventListener("click", () => {
        document.querySelectorAll(".character-select").forEach(i => i.classList.remove("selected"));
        img.classList.add("selected");
        selectedCharacter = img.dataset.character === "연지" ? "yeonji" : "jieun";
        console.log("👤 선택된 캐릭터:", selectedCharacter);
      });
    });

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
