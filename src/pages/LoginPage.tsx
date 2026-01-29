import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 로그인 후 돌아갈 경로 (ProtectedRoute에서 전달됨)
  const from = (location.state as any)?.from || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 로그인
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('로그인 성공!');
      
      // 원래 가려던 페이지로 이동
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error('로그인 실패:', error);
      if (error.message.includes('Invalid login credentials')) {
        toast.error('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('이메일 인증이 필요합니다. 이메일을 확인해주세요.');
      } else {
        toast.error(error.message || '로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-md">
      <h1 className="text-4xl font-bold mb-8 text-center">로그인</h1>
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            이메일
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="이메일을 입력하세요"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="비밀번호를 입력하세요"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </Button>
        <p className="text-center text-sm text-gray-600">
          계정이 없으신가요?{' '}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="text-blue-500 hover:underline"
          >
            회원가입
          </button>
        </p>
      </form>
    </div>
  );
}
