import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ 현재 파일 경로 계산 (Render / 로컬 모두 대응)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ JSON 파일 직접 읽어서 파싱
const ebipMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'ebip-keywords.json'), 'utf-8'));
const ebikMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'ebik-keywords.json'), 'utf-8'));

// ✅ 통합 맵 생성
const allMaps = { ...ebipMap, ...ebikMap };

// ✅ 입력 텍스트에서 ko/en 단어 → ⟪TOKEN⟫ 으로 마스킹
function maskText(text) {
  let result = text;
  for (const [token, { ko, en }] of Object.entries(allMaps)) {
    ko.forEach(word => {
      const regex = new RegExp(`${word}(?:[을를이가은는도만은야요좀좀]*)?`, "gi");
      result = result.replace(regex, `⟪${token}⟫`);
    });
    en.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi"); // 영어는 단어경계 유지
      result = result.replace(regex, `⟪${token}⟫`);
    });
  }
  console.log("🔒 [EBIM] 마스킹 결과:", result);
  return result;
}


// ✅ ⟪TOKEN⟫ → 랜덤한 한국어 단어 복원 (최종 출력용)
function unmaskToKorean(text) {
  let result = text;
  for (const [token, { ko }] of Object.entries(allMaps)) {
    const choice = ko[Math.floor(Math.random() * ko.length)];
    result = result.replaceAll(`⟪${token}⟫`, choice);
  }
  //console.log("🎯 [EBIM] 한국어 복원 결과:", result);
  return result;
}

// ✅ ⟪TOKEN⟫ → 랜덤한 영어 단어 복원 (MythoMax 전송용)
function unmaskToEnglish(text) {
  let result = text;
  for (const [token, { en }] of Object.entries(allMaps)) {
    const choice = en[Math.floor(Math.random() * en.length)];
    result = result.replaceAll(`⟪${token}⟫`, choice);
  }
  //console.log("🎯 [EBIM] 영어 복원 결과:", result);
  return result;
}

export {
  maskText,
  unmaskToKorean,
  unmaskToEnglish
};
