import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Comments from '@/components/Comments';
import { toast } from 'sonner';

interface Post {
  id: string;
  title: string;
  content: string;
  slug: string | null;
  tags: string[] | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  author_id: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [id]);

  useEffect(() => {
    if (post) {
      fetchLikes();
    }
  }, [post, user]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPost(data);

      // 조회수 증가 (비동기, 에러 무시)
      if (data) {
        void supabase
          .from('posts')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', id)
          .then(() => {
            // 조회수 증가 후 post state 업데이트
            setPost({ ...data, view_count: (data.view_count || 0) + 1 });
          });
      }
    } catch (error) {
      console.error('게시글 불러오기 실패:', error);
      toast.error('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLikes = async () => {
    if (!post) return;

    try {
      // 좋아요 총 개수
      const { count, error: countError } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (countError) throw countError;
      setLikesCount(count || 0);

      // 내가 좋아요 했는지 확인
      if (user) {
        const { data, error: likeError } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (likeError) {
          throw likeError;
        }

        setIsLiked(!!data);
      } else {
        setIsLiked(false);
      }
    } catch (error) {
      console.error('좋아요 정보 조회 실패:', error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!post) return;

    // 애니메이션 시작
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 600);

    try {
      if (isLiked) {
        // 좋아요 취소
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        // 좋아요
        const { error } = await supabase
          .from('likes')
          .insert([
            {
              post_id: post.id,
              user_id: user.id,
            },
          ]);

        if (error) throw error;

        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (error: any) {
      console.error('좋아요 실패:', error);
      if (error.code === '23505') {
        // 중복 좋아요 (이미 좋아요 한 경우)
        toast.error('이미 좋아요를 누르셨습니다.');
        fetchLikes(); // 상태 다시 불러오기
      } else {
        toast.error('좋아요에 실패했습니다.');
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('삭제되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-8">로딩 중...</div>;
  }

  if (!post) {
    return <div className="container mx-auto p-8">게시글을 찾을 수 없습니다.</div>;
  }

  const isAuthor = user?.id === post.author_id;

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="outline" onClick={() => navigate('/')}>
          목록으로
        </Button>
      </div>
      <article className="bg-white border rounded-lg p-8 shadow-sm">
        {/* 제목 */}
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        
        {/* 작성자 정보 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            {post.profiles?.avatar_url ? (
              <img
                src={post.profiles.avatar_url}
                alt={post.profiles.username || '프로필'}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="font-medium">{post.profiles?.username || '익명'}</p>
              <p className="text-sm text-gray-400">
                {new Date(post.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          
          {/* 공개 상태 */}
          {!post.is_public && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              🔒 비공개
            </span>
          )}
        </div>

        {/* 태그 */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 내용 */}
        <div className="prose max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
          {post.content}
        </div>

        {/* 좋아요 버튼 */}
        <div className="mt-8 pt-6 border-t border-b pb-6">
          <div className="flex items-center justify-center">
            <button
              onClick={handleLike}
              className={`group flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-300 ${
                isLiked
                  ? 'bg-red-50 hover:bg-red-100'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <Heart
                className={`transition-all duration-300 ${
                  likeAnimating ? 'scale-125' : 'scale-100'
                } ${
                  isLiked
                    ? 'text-red-500 fill-red-500'
                    : 'text-gray-400 group-hover:text-red-400'
                }`}
                size={28}
              />
              <div className="text-left">
                <div
                  className={`font-semibold transition-colors ${
                    isLiked ? 'text-red-500' : 'text-gray-700'
                  }`}
                >
                  {likesCount === 0
                    ? '좋아요'
                    : likesCount === 1
                    ? '1명이 좋아합니다'
                    : `${likesCount}명이 좋아합니다`}
                </div>
                {!user && (
                  <div className="text-xs text-gray-500">
                    로그인하여 좋아요를 눌러보세요
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* 작성자 액션 버튼 */}
        {isAuthor && (
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/edit/${post.id}`)}>
              수정
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </div>
        )}

        {/* 댓글 섹션 */}
        <Comments postId={post.id} />
      </article>
    </div>
  );
}
