import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import SearchBar from '@/components/SearchBar';
import { toast } from 'sonner';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('로그아웃되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('로그아웃 실패:', error);
      toast.error('로그아웃에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold">my blog</div>
          <div>로딩 중...</div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b bg-white sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-6">
          {/* 로고 */}
          <div
            className="text-2xl font-bold cursor-pointer hover:text-blue-600 transition-colors whitespace-nowrap"
            onClick={() => navigate('/')}
          >
            my blog
          </div>

          {/* 검색창 */}
          <div className="flex-1 max-w-2xl">
            <SearchBar />
          </div>

          {/* 우측 메뉴 */}
          <div className="flex items-center gap-3 whitespace-nowrap">
            {user ? (
              <>
                <Button onClick={() => navigate('/write')}>글쓰기</Button>
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-3 py-2 rounded-md transition-colors"
                  onClick={() => navigate('/mypage')}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username || '프로필'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                      {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium hidden lg:inline">
                    {profile?.username || user.email}
                  </span>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate('/login')}>
                  로그인
                </Button>
                <Button onClick={() => navigate('/signup')}>회원가입</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
