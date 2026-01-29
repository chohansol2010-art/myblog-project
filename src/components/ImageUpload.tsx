import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  userId: string;
}

export default function ImageUpload({ value, onChange, userId }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 리사이징 함수
  const resizeImage = (file: File, maxWidth: number = 1920): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 최대 너비보다 크면 리사이징
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create blob'));
              }
            },
            file.type,
            0.9
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // 파일 검증
  const validateFile = (file: File): boolean => {
    // 파일 타입 체크
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('JPG, PNG, WEBP 파일만 업로드 가능합니다.');
      return false;
    }

    // 파일 크기 체크 (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('파일이 너무 큽니다. 최대 5MB까지 업로드 가능합니다.');
      return false;
    }

    return true;
  };

  // 파일 업로드
  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setProgress(0);

    try {
      // 이미지 리사이징
      setProgress(20);
      const resizedBlob = await resizeImage(file);

      // 파일명 생성 (사용자ID/timestamp_원본파일명)
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      setProgress(40);

      // Supabase Storage에 업로드
      const { error } = await supabase.storage
        .from('post-thumbnails')
        .upload(fileName, resizedBlob, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setProgress(80);

      // 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from('post-thumbnails')
        .getPublicUrl(fileName);

      setProgress(100);

      onChange(urlData.publicUrl);
      toast.success('이미지가 업로드되었습니다!');
    } catch (error: any) {
      console.error('업로드 실패:', error);
      toast.error('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
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
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  // 파일 선택 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  // 이미지 삭제
  const handleDelete = async () => {
    if (!value) return;

    try {
      // URL에서 파일 경로 추출
      const url = new URL(value);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts.slice(-2).join('/'); // userId/filename

      // Storage에서 삭제
      const { error } = await supabase.storage
        .from('post-thumbnails')
        .remove([fileName]);

      if (error) {
        console.error('삭제 실패:', error);
        // 에러가 있어도 URL은 제거 (이미 삭제되었을 수 있음)
      }

      onChange('');
      toast.success('이미지가 삭제되었습니다.');
    } catch (error) {
      console.error('삭제 중 오류:', error);
      onChange('');
    }
  };

  return (
    <div className="space-y-4">
      {value ? (
        // 업로드된 이미지 미리보기
        <div className="relative">
          <img
            src={value}
            alt="업로드된 이미지"
            className="w-full h-64 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
            disabled={uploading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        // 업로드 영역
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleChange}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">업로드 중... {progress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                {dragActive ? (
                  <Upload className="w-12 h-12 text-blue-500" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  이미지를 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG, WEBP · 최대 5MB · 자동 리사이징 (최대 1920px)
                </p>
              </div>
              <Button type="button" variant="outline" size="sm">
                파일 선택
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
