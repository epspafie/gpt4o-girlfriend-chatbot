import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log("✅ Supabase URL:", process.env.SUPABASE_URL);
console.log("✅ Supabase KEY:", process.env.SUPABASE_ANON_KEY?.slice(0, 10)); // 앞 10자만 표시

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default supabase;
