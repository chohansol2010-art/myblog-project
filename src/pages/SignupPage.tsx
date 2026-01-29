import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!email.trim()) {
      toast.error('이메일을 입력해주세요.');
      return false;
    }

    if (!email.includes('@')) {
      toast.error('올바른 이메일 형식이 아닙니다.');
      return false;
    }

    if (!password) {
      toast.error('비밀번호를 입력해주세요.');
      return false;
    }

    if (password.length < 8) {
      toast.error('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }

    if (password !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (!nickname.trim()) {
      toast.error('닉네임을 입력해주세요.');
      return false;
    }

    if (nickname.length < 2) {
      toast.error('닉네임은 최소 2자 이상이어야 합니다.');
      return false;
    }

    if (bio.length > 200) {
      toast.error('자기소개는 200자 이내로 작성해주세요.');
      return false;
    }

    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // 1. 닉네임 중복 확인
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', nickname)
        .maybeSingle();

      if (existingUsername) {
        toast.error('이미 사용 중인 닉네임입니다.');
        setLoading(false);
        return;
      }

      // 2. Supabase Auth에 회원가입 (metadata에 username과 bio 포함)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: nickname,
            bio: bio.trim() || null,
          },
        },
      });

      if (authError) {
        // 이메일 중복 확인
        if (
          authError.message.includes('already registered') ||
          authError.message.includes('User already registered')
        ) {
          toast.error('이미 가입된 이메일입니다.');
        } else {
          toast.error(authError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 3. 개발 환경에서는 이메일 자동 확인 처리
      if (import.meta.env.DEV) {
        try {
          await supabase.rpc('confirm_user_email', { user_id: authData.user.id });
        } catch (confirmError) {
          console.log('이메일 자동 확인 실패 (무시):', confirmError);
          // 에러가 발생해도 계속 진행 (function이 없을 수 있음)
        }
      }

      // 4. 트리거가 자동으로 profiles 테이블 생성 (username과 bio는 metadata에서 자동 추출)
      // 잠시 대기하여 트리거 실행을 보장
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 5. 프로필이 제대로 생성되었는지 확인
      const { data: profile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileCheckError || !profile) {
        console.error('프로필 확인 실패:', profileCheckError);
        toast.error('프로필 생성 확인에 실패했습니다. 잠시 후 다시 로그인해주세요.');
        setLoading(false);
        return;
      }

      // 6. 성공
      toast.success('회원가입이 완료되었습니다!');
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (error: any) {
      console.error('회원가입 실패:', error);
      toast.error('회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-md">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-900 dark:text-white">
          회원가입
        </h1>
        <form onSubmit={handleSignup} className="space-y-6">
          {/* 이메일 */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              이메일 주소 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="example@email.com"
              required
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              비밀번호 (8자 이상) <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="최소 8자 이상"
              required
              minLength={8}
            />
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              비밀번호 확인 <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
          </div>

          {/* 닉네임 */}
          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              닉네임 <span className="text-red-500">*</span>
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="사용할 닉네임을 입력하세요"
              required
              minLength={2}
            />
          </div>

          {/* 자기소개 */}
          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              자기소개 (선택, 200자 내외)
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white"
              placeholder="자기소개를 입력하세요 (200자 이내)"
              maxLength={200}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
              {bio.length} / 200자
            </p>
          </div>

          {/* 회원가입 버튼 */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '가입 중...' : '회원가입'}
          </Button>

          {/* 로그인 링크 */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            이미 계정이 있으신가요?{' '}
            <Link
              to="/login"
              className="text-blue-500 hover:underline font-medium"
            >
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
