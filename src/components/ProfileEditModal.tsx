import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileEditModal({ open, onOpenChange }: ProfileEditModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폼 상태
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [emailVisible, setEmailVisible] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 프로필 데이터 로드
  useEffect(() => {
    if (profile && open) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setEmailVisible(profile.email_visible ?? true);
      setPreviewUrl(profile.avatar_url || null);
      setAvatarFile(null);
    }
  }, [profile, open]);

  // 파일 선택 핸들러
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 드래그 앤 드롭 핸들러
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // 파일 입력 변경 핸들러
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // 이미지 제거
  const handleRemoveImage = () => {
    setAvatarFile(null);
    setPreviewUrl(profile?.avatar_url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    if (!user) return;

    if (!username.trim()) {
      toast.error('닉네임을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = profile?.avatar_url;

      // 새 이미지 업로드
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-thumbnails')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('post-thumbnails')
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl;
      }

      // 프로필 업데이트
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          email_visible: emailVisible,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('프로필이 수정되었습니다.');
      await refreshProfile();
      onOpenChange(false);
      
      // 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('프로필 업데이트 실패:', error);
      if (error.code === '23505') {
        toast.error('이미 사용 중인 닉네임입니다.');
      } else {
        toast.error('프로필 수정에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>프로필 편집</DialogTitle>
          <DialogDescription>
            프로필 정보를 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 프로필 사진 */}
          <div className="space-y-2">
            <Label>프로필 사진</Label>
            
            {/* 현재 사진 미리보기 */}
            <div className="flex items-center gap-4">
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="프로필 미리보기"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                  {avatarFile && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-4xl font-semibold">
                  {username?.[0]?.toUpperCase() || profile?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                사진 변경
              </Button>
            </div>

            {/* 드래그 앤 드롭 영역 */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                드래그 앤 드롭 또는 클릭하여 이미지 업로드
              </p>
              <p className="text-xs text-gray-400">
                PNG, JPG, GIF (최대 5MB)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* 닉네임 */}
          <div className="space-y-2">
            <Label htmlFor="username">닉네임</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="닉네임을 입력하세요"
              maxLength={20}
            />
          </div>

          {/* 한 줄 소개 */}
          <div className="space-y-2">
            <Label htmlFor="bio">한 줄 소개</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="자신을 소개해주세요"
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-gray-500 text-right">
              {bio.length} / 200
            </p>
          </div>

          {/* 이메일 공개 여부 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>이메일 공개</Label>
              <p className="text-sm text-gray-500">
                다른 사용자에게 이메일을 공개합니다
              </p>
            </div>
            <Switch
              checked={emailVisible}
              onCheckedChange={setEmailVisible}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
