import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FileText, User, Calendar, Eye, Heart } from 'lucide-react';
import { toast } from 'sonner';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  view_count: number;
  author_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface Author {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface PostWithStats extends Post {
  likes_count: number;
  comments_count: number;
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  
  const [posts, setPosts] = useState<PostWithStats[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (query) {
      performSearch(query);
    } else {
      setLoading(false);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      // 글 검색 (제목 또는 내용에 검색어 포함)
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_author_id_fkey (username, avatar_url),
          likes:likes(count),
          comments:comments(count)
        `)
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      const postsWithStats = (postsData || []).map((post: any) => ({
        ...post,
        likes_count: post.likes?.[0]?.count || 0,
        comments_count: post.comments?.[0]?.count || 0,
      }));

      setPosts(postsWithStats);

      // 작성자 검색 (닉네임에 검색어 포함)
      const { data: authorsData, error: authorsError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, created_at')
        .ilike('username', `%${searchQuery}%`)
        .limit(20);

      if (authorsError) throw authorsError;

      setAuthors(authorsData || []);
    } catch (error) {
      console.error('검색 실패:', error);
      toast.error('검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 검색어 하이라이트 함수
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-200 px-1 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  if (!query) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <div className="text-center py-20">
          <Search className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold mb-2">검색어를 입력해주세요</h2>
          <p className="text-gray-600">찾고 싶은 글이나 작성자를 검색해보세요</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <div className="text-center py-20">
          <div className="text-xl">검색 중...</div>
        </div>
      </div>
    );
  }

  const totalResults = posts.length + authors.length;

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      {/* 검색 결과 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          검색 결과: "{query}"
        </h1>
        <p className="text-gray-600">
          총 {totalResults}개의 결과를 찾았습니다
        </p>
      </div>

      {/* 결과 없음 */}
      {totalResults === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-2">검색 결과가 없습니다</p>
            <p className="text-sm text-gray-400">다른 검색어로 시도해보세요</p>
          </CardContent>
        </Card>
      )}

      {/* 검색 결과 탭 */}
      {totalResults > 0 && (
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="posts">
              글 ({posts.length})
            </TabsTrigger>
            <TabsTrigger value="authors">
              작성자 ({authors.length})
            </TabsTrigger>
          </TabsList>

          {/* 글 결과 */}
          <TabsContent value="posts" className="mt-6">
            {posts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">검색된 글이 없습니다</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Card
                    key={post.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">
                        {highlightText(post.title, query)}
                      </CardTitle>
                      <CardDescription>
                        {highlightText(
                          post.content.substring(0, 150) +
                            (post.content.length > 150 ? '...' : ''),
                          query
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {post.profiles?.avatar_url ? (
                              <img
                                src={post.profiles.avatar_url}
                                alt={post.profiles.username}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                                {post.profiles?.username?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <span>{post.profiles?.username}</span>
                          </div>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {post.view_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            {post.likes_count}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(post.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 작성자 결과 */}
          <TabsContent value="authors" className="mt-6">
            {authors.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">검색된 작성자가 없습니다</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {authors.map((author) => (
                  <Card
                    key={author.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      // 작성자 페이지로 이동 (향후 구현)
                      toast.info('작성자 페이지는 곧 추가될 예정입니다.');
                    }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        {author.avatar_url ? (
                          <img
                            src={author.avatar_url}
                            alt={author.username}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                            {author.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1">
                            {highlightText(author.username, query)}
                          </h3>
                          {author.bio && (
                            <p className="text-sm text-gray-600 mb-2">{author.bio}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            가입일: {new Date(author.created_at).toLocaleDateString('ko-KR')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
