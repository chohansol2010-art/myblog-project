import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import ImageUpload from '@/components/ImageUpload';
import { toast } from 'sonner';

export default function WritePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);

  // 제목이 변경될 때 자동으로 slug 생성
  useEffect(() => {
    if (title) {
      const generatedSlug = generateSlug(title);
      setSlug(generatedSlug);
    }
  }, [title]);

  // 한글을 영어로 변환하고 URL 친화적인 slug 생성
  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // 공백을 하이픈으로
      .replace(/[^\w\u3131-\u3163\uac00-\ud7a3-]/g, '') // 특수문자 제거 (한글 유지)
      .replace(/--+/g, '-') // 연속된 하이픈을 하나로
      .substring(0, 100); // 최대 100자
  };

  // 태그 파싱 (쉼표로 구분, 최대 5개)
  const parseTags = (tagString: string): string[] => {
    return tagString
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 5); // 최대 5개
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const parsedTags = parseTags(tags);
    if (tags.trim() && parsedTags.length === 0) {
      toast.error('올바른 태그 형식을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            title: title.trim(),
            content: content.trim(),
            slug: slug || generateSlug(title),
            tags: parsedTags.length > 0 ? parsedTags : null,
            thumbnail_url: thumbnailUrl.trim() || null,
            is_public: isPublic,
            author_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        // slug 중복 에러 처리
        if (error.message.includes('duplicate key value')) {
          toast.error('동일한 제목의 글이 이미 존재합니다. 제목을 변경해주세요.');
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      toast.success('게시글이 발행되었습니다!');
      navigate(`/post/${data.id}`);
    } catch (error) {
      console.error('게시글 작성 실패:', error);
      toast.error('게시글 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">글쓰기</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || '프로필'}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                    {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="font-medium">{profile?.username || user?.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                disabled={loading}
              >
                취소
              </Button>
              <Button type="submit" onClick={handleSubmit} disabled={loading}>
                {loading ? '발행 중...' : '발행하기'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-8 py-8 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 제목 */}
          <div>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-6 py-4 text-4xl font-bold border-0 focus:outline-none focus:ring-0 bg-white rounded-lg"
              placeholder="제목을 입력하세요"
              required
            />
          </div>

          {/* URL 슬러그 미리보기 */}
          {slug && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="text-sm text-blue-700">
                <span className="font-medium">URL 주소:</span>{' '}
                <span className="font-mono">/{slug}</span>
              </div>
            </div>
          )}

          {/* 내용 */}
          <div>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-6 py-4 border-0 focus:outline-none focus:ring-0 bg-white rounded-lg resize-none"
              style={{ minHeight: '500px' }}
              placeholder="내용을 입력하세요..."
              required
            />
          </div>

          {/* 태그 입력 */}
          <div className="bg-white rounded-lg p-6">
            <label htmlFor="tags" className="block text-sm font-medium mb-2 text-gray-700">
              태그 <span className="text-gray-400">(쉼표로 구분, 최대 5개)</span>
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: React, TypeScript, 웹개발"
            />
            {tags && (
              <div className="mt-3 flex flex-wrap gap-2">
                {parseTags(tags).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                  >
                    #{tag}
                  </span>
                ))}
                {parseTags(tags).length >= 5 && (
                  <span className="text-xs text-red-500">최대 5개까지 입력 가능합니다</span>
                )}
              </div>
            )}
          </div>

          {/* 대표 이미지 업로드 */}
          <div className="bg-white rounded-lg p-6">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              대표 이미지 <span className="text-gray-400">(선택)</span>
            </label>
            <ImageUpload
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
              userId={user?.id || ''}
            />
          </div>

          {/* 설정 옵션 */}
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">설정</h3>
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="visibility" className="font-medium text-gray-700">
                  공개 설정
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  {isPublic ? '모든 사람이 볼 수 있습니다' : '나만 볼 수 있습니다'}
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
