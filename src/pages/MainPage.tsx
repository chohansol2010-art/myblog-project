import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, MessageCircle, Eye } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  slug: string | null;
  tags: string[] | null;
  is_public: boolean;
  thumbnail_url: string | null;
  view_count: number;
  created_at: string;
  author_id: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
  likes_count?: number;
  comments_count?: number;
}

type SortOption = 'latest' | 'popular';

export default function MainPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [sortBy]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq('is_public', true);

      // 정렬 옵션
      if (sortBy === 'latest') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      // 좋아요 수와 댓글 수 추가
      const postsWithCounts = await Promise.all(
        (data || []).map(async (post) => {
          // 좋아요 수
          const { count: likesCount } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          // 댓글 수
          const { count: commentsCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          return {
            ...post,
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0,
          };
        })
      );

      // 인기순 정렬 (좋아요 + 댓글)
      if (sortBy === 'popular') {
        postsWithCounts.sort((a, b) => {
          const scoreA = (a.likes_count || 0) + (a.comments_count || 0) * 2;
          const scoreB = (b.likes_count || 0) + (b.comments_count || 0) * 2;
          return scoreB - scoreA;
        });
      }

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('게시글 불러오기 실패:', error);
      toast.error('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상대 시간 표시 (예: "3일 전")
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}년 전`;
    if (months > 0) return `${months}개월 전`;
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
  };

  // 그라데이션 배경 색상 (랜덤)
  const gradients = [
    'bg-gradient-to-br from-purple-400 to-pink-500',
    'bg-gradient-to-br from-blue-400 to-cyan-500',
    'bg-gradient-to-br from-green-400 to-teal-500',
    'bg-gradient-to-br from-orange-400 to-red-500',
    'bg-gradient-to-br from-indigo-400 to-purple-500',
    'bg-gradient-to-br from-pink-400 to-rose-500',
  ];

  const getGradient = (index: number): string => {
    return gradients[index % gradients.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">블로그 게시글</h1>
            <p className="text-gray-600">총 {posts.length}개의 게시글</p>
          </div>
          
          {/* 정렬 옵션 */}
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'latest' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('latest')}
            >
              최신순
            </Button>
            <Button
              variant={sortBy === 'popular' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('popular')}
            >
              인기순
            </Button>
          </div>
        </div>
      </div>

      {/* 게시글 그리드 */}
      {posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg mb-4">아직 게시글이 없습니다.</p>
          <Button onClick={() => navigate('/write')}>첫 게시글 작성하기</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post, index) => (
            <div
              key={post.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-gray-100"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              {/* 대표 이미지 또는 그라데이션 */}
              <div className="relative h-48 overflow-hidden">
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt={post.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className={`w-full h-full ${getGradient(index)} flex items-center justify-center`}>
                    <span className="text-white text-4xl font-bold opacity-50">
                      {post.title[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* 카드 내용 */}
              <div className="p-5">
                {/* 태그 */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {post.tags.slice(0, 2).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                      >
                        #{tag}
                      </span>
                    ))}
                    {post.tags.length > 2 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        +{post.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* 제목 */}
                <h3 className="text-xl font-bold mb-2 line-clamp-2 hover:text-blue-600 transition-colors">
                  {post.title}
                </h3>

                {/* 내용 미리보기 */}
                <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                  {post.content}
                </p>

                {/* 작성자 정보 */}
                <div className="flex items-center gap-2 mb-4">
                  {post.profiles?.avatar_url ? (
                    <img
                      src={post.profiles.avatar_url}
                      alt={post.profiles.username || '프로필'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
                      {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {post.profiles?.username || '익명'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getRelativeTime(post.created_at)}
                    </p>
                  </div>
                </div>

                {/* 통계 정보 */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">{post.likes_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm">{post.comments_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">{post.view_count || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
