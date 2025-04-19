import supabase from './supabase.js';

export async function saveMessage(user_id, role, message) {
  const { data, error } = await supabase.from('messages').insert([
    {
      user_id,
      role,
      message
    }
  ]);

  if (error) {
    console.error('❌ 저장 실패:', error.message);
  } else {
    console.log('✅ 저장 완료:', data);
  }
}
