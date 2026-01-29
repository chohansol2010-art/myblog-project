import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
  likes_count?: number;
  is_liked?: boolean;
  replies?: Comment[];
  depth?: number;
}

interface CommentsProps {
  postId: string;
}

const COMMENTS_PER_PAGE = 20;

export default function Comments({ postId }: CommentsProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
  }, [postId, user]);

  // 상대 시간 표시
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
  };

  // 댓글을 계층 구조로 정리
  const organizeComments = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // 모든 댓글을 맵에 저장하고 replies 배열 초기화
    flatComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [], depth: 0 });
    });

    // 계층 구조 구성
    flatComments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id)!;

      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          // 부모의 depth + 1, 최대 2단계까지만
          const parentDepth = parent.depth || 0;
          commentWithReplies.depth = Math.min(parentDepth + 1, 2);
          
          // 최대 2단계까지만: depth가 2 이상이면 부모의 부모에 추가
          if (parentDepth >= 1 && parent.parent_id) {
            const grandParent = commentMap.get(parent.parent_id);
            if (grandParent) {
              grandParent.replies!.push(commentWithReplies);
            } else {
              parent.replies!.push(commentWithReplies);
            }
          } else {
            parent.replies!.push(commentWithReplies);
          }
        } else {
          // 부모를 찾을 수 없으면 최상위로
          rootComments.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    // 각 레벨에서 최신순 정렬
    const sortByDate = (a: Comment, b: Comment) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    rootComments.sort(sortByDate);
    rootComments.forEach((comment) => {
      if (comment.replies) {
        comment.replies.sort(sortByDate);
        comment.replies.forEach((reply) => {
          if (reply.replies) {
            reply.replies.sort(sortByDate);
          }
        });
      }
    });

    return rootComments;
  };

  // 댓글 목록 가져오기
  const fetchComments = async (loadMore = false) => {
    try {
      const currentOffset = loadMore ? offset : 0;

      const { data, error, count } = await supabase
        .from('comments')
        .select(
          `
          *,
          profiles (
            username,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + COMMENTS_PER_PAGE - 1);

      if (error) throw error;

      // 좋아요 수와 내가 좋아요 했는지 확인 (삭제된 댓글은 제외)
      const commentsWithLikes = await Promise.all(
        (data || []).map(async (comment) => {
          // 삭제된 댓글은 좋아요 정보를 가져오지 않음
          if (comment.is_deleted) {
            return {
              ...comment,
              likes_count: 0,
              is_liked: false,
            };
          }

          // 좋아요 수
          const { count: likesCount } = await supabase
            .from('comment_likes')
            .select('*', { count: 'exact', head: true })
            .eq('comment_id', comment.id);

          // 내가 좋아요 했는지
          let isLiked = false;
          if (user) {
            const { data: likeData } = await supabase
              .from('comment_likes')
              .select('id')
              .eq('comment_id', comment.id)
              .eq('user_id', user.id)
              .single();
            isLiked = !!likeData;
          }

          return {
            ...comment,
            likes_count: likesCount || 0,
            is_liked: isLiked,
          };
        })
      );

      const organizedComments = organizeComments(commentsWithLikes);

      if (loadMore) {
        setComments([...comments, ...organizedComments]);
      } else {
        setComments(organizedComments);
      }

      setHasMore((count || 0) > currentOffset + COMMENTS_PER_PAGE);
      if (loadMore) {
        setOffset(currentOffset + COMMENTS_PER_PAGE);
      }
    } catch (error) {
      console.error('댓글 불러오기 실패:', error);
      toast.error('댓글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 댓글 작성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!newComment.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    if (newComment.length > 1000) {
      toast.error('댓글은 최대 1000자까지 입력 가능합니다.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('comments').insert([
        {
          post_id: postId,
          user_id: user.id,
          content: newComment.trim(),
          parent_id: null,
        },
      ]);

      if (error) throw error;

      setNewComment('');
      toast.success('댓글이 작성되었습니다!');
      setOffset(0);
      fetchComments();
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      toast.error('댓글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 답글 작성
  const handleReplySubmit = async (parentId: string, parentUsername: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!replyContent.trim()) {
      toast.error('답글 내용을 입력해주세요.');
      return;
    }

    if (replyContent.length > 1000) {
      toast.error('답글은 최대 1000자까지 입력 가능합니다.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('comments').insert([
        {
          post_id: postId,
          user_id: user.id,
          parent_id: parentId,
          content: replyContent.trim(),
        },
      ]);

      if (error) throw error;

      setReplyContent('');
      setReplyingTo(null);
      toast.success('답글이 작성되었습니다!');
      fetchComments();
    } catch (error) {
      console.error('답글 작성 실패:', error);
      toast.error('답글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 댓글 수정
  const handleUpdate = async (commentId: string) => {
    if (!editContent.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    if (editContent.length > 1000) {
      toast.error('댓글은 최대 1000자까지 입력 가능합니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .update({
          content: editContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setEditingId(null);
      setEditContent('');
      toast.success('댓글이 수정되었습니다!');
      fetchComments();
    } catch (error) {
      console.error('댓글 수정 실패:', error);
      toast.error('댓글 수정에 실패했습니다.');
    }
  };

  // 댓글 삭제 (소프트 삭제)
  const handleDelete = async (commentId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('댓글이 삭제되었습니다.');
      fetchComments();
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      toast.error('댓글 삭제에 실패했습니다.');
    }
  };

  // 좋아요 토글
  const handleLike = async (commentId: string, isLiked: boolean) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      if (isLiked) {
        // 좋아요 취소
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // 좋아요
        const { error } = await supabase.from('comment_likes').insert([
          {
            comment_id: commentId,
            user_id: user.id,
          },
        ]);

        if (error) throw error;
      }

      // 댓글 목록 새로고침
      fetchComments();
    } catch (error) {
      console.error('좋아요 실패:', error);
      toast.error('좋아요에 실패했습니다.');
    }
  };

  // Textarea 자동 높이 조절
  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  // 답글 버튼 클릭
  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo(commentId);
    setReplyContent(`@${username} `);
    // 약간의 지연 후 포커스
    setTimeout(() => {
      replyTextareaRef.current?.focus();
    }, 100);
  };

  // 개별 댓글 렌더링 (재귀적)
  const renderComment = (comment: Comment, depth: number = 0) => {
    const isMaxDepth = depth >= 2;
    const indentClass = depth === 0 ? '' : depth === 1 ? 'ml-12' : 'ml-12';
    const showConnector = depth > 0;

    return (
      <div key={comment.id} className={`${indentClass} relative`}>
        {/* 연결선 */}
        {showConnector && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 -ml-6"></div>
        )}

        <div className="flex gap-3 mb-4">
          {comment.is_deleted ? (
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
              <span className="text-gray-500 text-xs">삭제</span>
            </div>
          ) : comment.profiles?.avatar_url ? (
            <img
              src={comment.profiles.avatar_url}
              alt={comment.profiles.username || '프로필'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {comment.profiles?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">
                {comment.is_deleted ? '(알 수 없음)' : (comment.profiles?.username || '익명')}
              </span>
              <span className="text-sm text-gray-500">
                {getRelativeTime(comment.created_at)}
              </span>
              {comment.updated_at !== comment.created_at && !comment.is_deleted && (
                <span className="text-xs text-gray-400">(수정됨)</span>
              )}
            </div>

            {comment.is_deleted ? (
              // 삭제된 댓글
              <div className="py-2 px-4 bg-gray-100 rounded-lg">
                <p className="text-gray-500 italic">삭제된 댓글입니다</p>
              </div>
            ) : editingId === comment.id ? (
              // 수정 모드
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    adjustTextareaHeight(e.target);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  maxLength={1000}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUpdate(comment.id)}
                  >
                    저장
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditContent('');
                    }}
                  >
                    취소
                  </Button>
                  <span className="text-sm text-gray-500 ml-auto">
                    {editContent.length} / 1000자
                  </span>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-800 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>

                <div className="flex items-center gap-4 mt-2">
                  {/* 좋아요 */}
                  <button
                    onClick={() =>
                      handleLike(comment.id, comment.is_liked || false)
                    }
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      comment.is_liked
                        ? 'text-red-500'
                        : 'text-gray-500 hover:text-red-500'
                    }`}
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={comment.is_liked ? 'currentColor' : 'none'}
                    />
                    <span>{comment.likes_count || 0}</span>
                  </button>

                  {/* 답글 버튼 (최대 2단계까지만) */}
                  {!isMaxDepth && user && (
                    <button
                      onClick={() =>
                        handleReplyClick(
                          comment.id,
                          comment.profiles?.username || '익명'
                        )
                      }
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>답글</span>
                    </button>
                  )}

                  {/* 내 댓글이면 수정/삭제 */}
                  {user?.id === comment.user_id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditContent(comment.content);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-sm text-gray-500 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* 답글 입력창 */}
            {replyingTo === comment.id && user && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username || '프로필'}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {profile?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="flex-1">
                    <textarea
                      ref={replyTextareaRef}
                      value={replyContent}
                      onChange={(e) => {
                        setReplyContent(e.target.value);
                        adjustTextareaHeight(e.target);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[60px]"
                      placeholder="답글을 입력하세요..."
                      maxLength={1000}
                      disabled={submitting}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500">
                        {replyContent.length} / 1000자
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent('');
                          }}
                        >
                          취소
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleReplySubmit(
                              comment.id,
                              comment.profiles?.username || '익명'
                            )
                          }
                          disabled={submitting || !replyContent.trim()}
                        >
                          {submitting ? '작성 중...' : '작성'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 답글 렌더링 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-0">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-8 border-t pt-8">
      <h2 className="text-2xl font-bold mb-6">
        댓글 <span className="text-gray-500">({comments.length})</span>
      </h2>

      {/* 댓글 입력 */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username || '프로필'}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  adjustTextareaHeight(e.target);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[80px]"
                placeholder="댓글을 입력하세요..."
                maxLength={1000}
                disabled={submitting}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-500">
                  {newComment.length} / 1000자
                </span>
                <Button type="submit" disabled={submitting || !newComment.trim()}>
                  {submitting ? '작성 중...' : '댓글 작성'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-6 border border-gray-300 rounded-lg text-center bg-gray-50">
          <p className="text-gray-600 mb-4">댓글을 쓰려면 로그인하세요</p>
          <Button onClick={() => navigate('/login')}>로그인</Button>
        </div>
      )}

      {/* 댓글 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => renderComment(comment, 0))}

          {/* 더보기 버튼 */}
          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchComments(true)}
              >
                댓글 더보기
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
