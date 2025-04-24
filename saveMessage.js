import supabase from './supabase.js';

// ✅ 일반 채팅 메시지 저장 (character + timestamp 포함)
export async function saveMessage(user_id, role, message, character = null) {
  const timestamp = new Date().toISOString();
  console.log("📤 saveMessage 호출됨:", user_id, role, character, message);
  try {
    const { data, error } = await supabase.from('messages').insert([
      {
        user_id,
        role,
        message,
        character,
        timestamp
      }
    ]);

    if (error) {
      console.error('❌ 메시지 저장 실패:', error.message);
    } else {
      console.log('✅ 메시지 저장 완료:', data);
    }
  } catch (err) {
    console.error('❌ 메시지 저장 중 예외 발생:', err.message);
  }
}

// ✅ 감정 저장 (emotion_log)
export async function saveEmotion(user_id, emotion) {
  try {
    const { error } = await supabase.from('emotion_log').insert([
      {
        user_id,
        emotion
      }
    ]);

    if (error) {
      console.error('❌ 감정 저장 실패:', error.message);
    } else {
      console.log('✅ 감정 저장 완료:', emotion);
    }
  } catch (err) {
    console.error('❌ 감정 저장 중 예외 발생:', err.message);
  }
}

// ✅ 사건 저장 (event_log)
export async function saveEvent(user_id, event) {
  try {
    const { error } = await supabase.from('event_log').insert([
      {
        user_id,
        event
      }
    ]);

    if (error) {
      console.error('❌ 사건 저장 실패:', error.message);
    } else {
      console.log('✅ 사건 저장 완료:', event);
    }
  } catch (err) {
    console.error('❌ 사건 저장 중 예외 발생:', err.message);
  }
}

// ✅ 사실 저장 (user_fact_log)
export async function saveFact(user_id, fact) {
  try {
    const { error } = await supabase.from('user_fact_log').insert([
      {
        user_id,
        fact
      }
    ]);

    if (error) {
      console.error('❌ 사실 저장 실패:', error.message);
    } else {
      console.log('✅ 사실 저장 완료:', fact);
    }
  } catch (err) {
    console.error('❌ 사실 저장 중 예외 발생:', err.message);
  }
}
