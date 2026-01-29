import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ProfileEditModal from '@/components/ProfileEditModal';
import { toast } from 'sonner';
import { Heart, FileText, Calendar, Upload, Eye, MessageCircle, Lock, Globe } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  thumbnail_url?: string;
  view_count?: number;
  is_public?: boolean;
}

interface PostWithDetails extends Post {
  likes_count: number;
  comments_count: number;
}

interface Stats {
  postsCount: number;
  totalLikes: number;
}

type SortOption = 'latest' | 'popular' | 'views';
type FilterOption = 'all' | 'public' | 'private';

export default function MyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [myPosts, setMyPosts] = useState<PostWithDetails[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostWithDetails[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<PostWithDetails[]>([]);
  const [stats, setStats] = useState<Stats>({ postsCount: 0, totalLikes: 0 });
  const [loading, setLoading] = useState(true);
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('latest');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // 정렬 및 필터링
  useEffect(() => {
    let filtered = [...myPosts];

    // 필터링
    if (filterOption === 'public') {
      filtered = filtered.filter((post) => post.is_public);
    } else if (filterOption === 'private') {
      filtered = filtered.filter((post) => !post.is_public);
    }

    // 정렬
    if (sortOption === 'latest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortOption === 'popular') {
      filtered.sort((a, b) => b.likes_count - a.likes_count);
    } else if (sortOption === 'views') {
      filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    }

    setFilteredPosts(filtered);
  }, [myPosts, sortOption, filterOption]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // 작성한 글 가져오기 (좋아요 수와 댓글 수 포함)
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          likes:likes(count),
          comments:comments(count)
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      const postsWithDetails = (postsData || []).map((post: any) => ({
        ...post,
        likes_count: post.likes?.[0]?.count || 0,
        comments_count: post.comments?.[0]?.count || 0,
      }));

      setMyPosts(postsWithDetails);

      // 좋아요한 글 가져오기
      const { data: likedData, error: likedError } = await supabase
        .from('likes')
        .select(`
          post_id,
          posts:post_id (
            *,
            likes:likes(count),
            comments:comments(count)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (likedError) throw likedError;

      const likedPostsWithDetails = (likedData || [])
        .filter((item: any) => item.posts)
        .map((item: any) => ({
          ...item.posts,
          likes_count: item.posts.likes?.[0]?.count || 0,
          comments_count: item.posts.comments?.[0]?.count || 0,
        }));

      setLikedPosts(likedPostsWithDetails);

      // 통계 정보 계산
      const totalLikes = postsWithDetails.reduce(
        (sum: number, post: PostWithDetails) => sum + post.likes_count,
        0
      );

      setStats({
        postsCount: postsWithDetails.length,
        totalLikes,
      });
    } catch (error) {
      console.error('데이터 불러오기 실패:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: string, postTitle: string) => {
    if (!confirm(`"${postTitle}" 게시글을 정말 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', user?.id);

      if (error) throw error;

      toast.success('게시글이 삭제되었습니다.');
      setMyPosts(myPosts.filter((post) => post.id !== postId));
      setStats((prev) => ({ ...prev, postsCount: prev.postsCount - 1 }));
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('게시글 삭제에 실패했습니다.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-thumbnails')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('post-thumbnails')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('프로필 사진이 변경되었습니다.');
      window.location.reload();
    } catch (error) {
      console.error('프로필 사진 업로드 실패:', error);
      toast.error('프로필 사진 업로드에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8 flex items-center justify-center min-h-screen">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  const renderPostCard = (post: PostWithDetails, showActions = true) => (
    <Card
      key={post.id}
      className="hover:shadow-lg transition-all cursor-pointer relative"
      onClick={() => navigate(`/post/${post.id}`)}
      onMouseEnter={() => setHoveredPostId(post.id)}
      onMouseLeave={() => setHoveredPostId(null)}
    >
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-xl">{post.title}</CardTitle>
              {post.is_public !== undefined && (
                <Badge variant={post.is_public ? 'default' : 'secondary'}>
                  {post.is_public ? (
                    <>
                      <Globe className="w-3 h-3" />
                      공개
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" />
                      비공개
                    </>
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>
              {post.content.substring(0, 100)}
              {post.content.length > 100 && '...'}
            </CardDescription>
          </div>
          {post.thumbnail_url && (
            <img
              src={post.thumbnail_url}
              alt={post.title}
              className="w-20 h-20 object-cover rounded-md"
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.view_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {post.likes_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              {post.comments_count}
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <Calendar className="w-4 h-4" />
              {new Date(post.created_at).toLocaleDateString('ko-KR')}
            </span>
          </div>

          {/* 호버 시 수정/삭제 버튼 */}
          {showActions && hoveredPostId === post.id && (
            <div
              className="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/edit/${post.id}`)}
              >
                수정
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(post.id, post.title)}
              >
                삭제
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      {/* 상단 프로필 영역 */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {/* 프로필 사진 */}
            <div
              className="relative"
              onMouseEnter={() => setIsHoveringAvatar(true)}
              onMouseLeave={() => setIsHoveringAvatar(false)}
            >
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username || '프로필'}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-4xl font-semibold">
                  {profile?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              {isHoveringAvatar && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer"
                >
                  <div className="flex flex-col items-center text-white">
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-xs">변경</span>
                  </div>
                </label>
              )}
            </div>

            {/* 내 정보 */}
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{profile?.username || '사용자'}</h2>
              <p className="text-gray-600 mb-2">{profile?.email || user?.email}</p>
              {profile?.bio && (
                <p className="text-gray-700 mt-3 p-3 bg-gray-50 rounded-md">
                  {profile.bio}
                </p>
              )}
              <p className="text-sm text-gray-400 mt-3 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                가입일: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ko-KR') : '-'}
              </p>
            </div>

            {/* 통계 정보 */}
            <div className="flex gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg min-w-[100px]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-600">{stats.postsCount}</div>
                <div className="text-sm text-gray-600">작성한 글</div>
              </div>
              <div className="text-center p-4 bg-pink-50 rounded-lg min-w-[100px]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Heart className="w-5 h-5 text-pink-600" />
                </div>
                <div className="text-2xl font-bold text-pink-600">{stats.totalLikes}</div>
                <div className="text-sm text-gray-600">받은 좋아요</div>
              </div>
            </div>
          </div>

          {/* 프로필 편집 버튼 */}
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setIsEditModalOpen(true)}>
              프로필 편집
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 탭 메뉴 */}
      <Tabs defaultValue="my-posts" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="my-posts">작성한 글</TabsTrigger>
          <TabsTrigger value="liked-posts">좋아요한 글</TabsTrigger>
        </TabsList>

        {/* 작성한 글 탭 */}
        <TabsContent value="my-posts" className="mt-6">
          {myPosts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-4">작성한 게시글이 없습니다.</p>
                <Button onClick={() => navigate('/write')}>첫 게시글 작성하기</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 정렬 및 필터 */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">정렬:</span>
                  <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">최신순</SelectItem>
                      <SelectItem value="popular">인기순</SelectItem>
                      <SelectItem value="views">조회수순</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">필터:</span>
                  <Select value={filterOption} onValueChange={(value) => setFilterOption(value as FilterOption)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 글</SelectItem>
                      <SelectItem value="public">공개 글</SelectItem>
                      <SelectItem value="private">비공개 글</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="ml-auto text-sm text-gray-500">
                  총 {filteredPosts.length}개의 게시글
                </div>
              </div>

              {/* 게시글 목록 */}
              <div className="grid gap-4">
                {filteredPosts.map((post) => renderPostCard(post))}
              </div>
            </>
          )}
        </TabsContent>

        {/* 좋아요한 글 탭 */}
        <TabsContent value="liked-posts" className="mt-6">
          {likedPosts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Heart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">좋아요한 게시글이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-500">
                총 {likedPosts.length}개의 게시글
              </div>
              <div className="grid gap-4">
                {likedPosts.map((post) => renderPostCard(post, false))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 프로필 편집 모달 */}
      <ProfileEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
      />
    </div>
  );
}
