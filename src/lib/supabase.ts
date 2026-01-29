import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_url_here' || 
    supabaseAnonKey === 'your_supabase_anon_key_here') {
  console.error(`
    ⚠️  Supabase 설정이 필요합니다!
    
    1. .env.local 파일을 열어주세요
    2. 다음 값들을 실제 Supabase 정보로 교체해주세요:
       - VITE_SUPABASE_URL=your_supabase_url_here
       - VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
    
    3. Supabase 정보는 https://supabase.com 대시보드의
       Settings > API 에서 확인할 수 있습니다.
    
    4. 개발 서버를 재시작해주세요 (Ctrl+C 후 npm run dev)
  `);
  
  throw new Error('Supabase URL과 Anon Key를 .env.local 파일에 설정해주세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
