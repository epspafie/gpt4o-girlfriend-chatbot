import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log("✅ Supabase URL:", process.env.SUPABASE_URL);
console.log("✅ Supabase KEY:", process.env.SUPABASE_ANON_KEY?.slice(0, 10)); // 앞 10자만 표시

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default supabase;

// ✅ NSFW 대화 저장
export async function saveNsfwChatLog(user_id, character, role, message) {
  const { error } = await supabase.from("nsfw_chat_log").insert([
    {
      user_id,
      character,
      role,
      message
    }
  ]);
  if (error) console.error("💥 NSFW 로그 저장 실패:", error.message);
}

// ✅ NSFW 최근 대화 불러오기
export async function getRecentNsfwMessages(user_id, limit = 5) {
  const { data, error } = await supabase
    .from("nsfw_chat_log")
    .select("role, message, character")
    .eq("user_id", user_id)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("💥 NSFW 최근 대화 불러오기 실패:", error.message);
    return [];
  }

  return data.reverse(); // 오래된 순서로 정렬


// ✅ 통합 메시지 불러오기 (SFW + NSFW)
}

// 통합 메시지 불러오기 (SFW + NSFW)
export async function getRecentUnifiedMessages(user_id = 'default-user', limit = 6) {
  const [sfwRes, nsfwRes] = await Promise.all([
    supabase.from('messages')
      .select('role, message, character, timestamp')
      .eq('user_id', user_id)
      .order('timestamp', { ascending: false })
      .limit(limit),
    supabase.from('nsfw_chat_log')
      .select('role, message, character, timestamp')
      .eq('user_id', user_id)
      .order('timestamp', { ascending: false })
      .limit(limit)
  ]);

  const all = [...(sfwRes.data || []), ...(nsfwRes.data || [])];
  return all
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-limit);
}
