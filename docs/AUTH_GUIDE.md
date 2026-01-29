# 인증 가이드

## 📌 개요

이 프로젝트는 Supabase를 사용한 인증 시스템을 구현했습니다.
`AuthContext`를 통해 전역에서 로그인한 사용자 정보에 접근할 수 있습니다.

## 🔐 보호된 페이지

다음 페이지들은 로그인이 필요합니다:

- `/write` - 글쓰기 페이지
- `/mypage` - 마이 페이지

로그인하지 않은 사용자가 이 페이지에 접근하려고 하면:
1. "로그인이 필요합니다" 토스트 메시지 표시
2. 로그인 페이지로 자동 리다이렉트
3. 로그인 후 원래 가려던 페이지로 자동 이동

## 🚀 useAuth 훅 사용법

### 기본 사용법

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function MyComponent() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div>
      {user ? (
        <div>
          <p>안녕하세요, {profile?.username}님!</p>
          <button onClick={signOut}>로그아웃</button>
        </div>
      ) : (
        <p>로그인해주세요.</p>
      )}
    </div>
  );
}
```

### useAuth 반환값

| 속성 | 타입 | 설명 |
|------|------|------|
| `user` | `User \| null` | Supabase Auth 사용자 객체 |
| `profile` | `Profile \| null` | 사용자 프로필 정보 (username, email, avatar_url, bio 등) |
| `loading` | `boolean` | 인증 상태 로딩 여부 |
| `signOut` | `() => Promise<void>` | 로그아웃 함수 |
| `refreshProfile` | `() => Promise<void>` | 프로필 정보 새로고침 |

### Profile 타입

```tsx
interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}
```

## 📝 사용 예제

### 1. 닉네임 표시

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { profile } = useAuth();

  return (
    <div>
      <h1>환영합니다, {profile?.username || '게스트'}님!</h1>
    </div>
  );
}
```

### 2. 프로필 이미지 표시

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileImage() {
  const { user, profile } = useAuth();

  return (
    <div>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.username || '프로필'}
          className="w-10 h-10 rounded-full"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
          {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
        </div>
      )}
    </div>
  );
}
```

### 3. 조건부 렌더링

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function PostActions() {
  const { user, profile } = useAuth();

  return (
    <div>
      {user ? (
        <button>글쓰기</button>
      ) : (
        <p>글을 작성하려면 로그인이 필요합니다.</p>
      )}
    </div>
  );
}
```

### 4. 사용자 ID 사용 (게시글 작성)

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function CreatePost() {
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          title: 'My Post',
          content: 'Content here',
          author_id: user.id,  // 현재 로그인한 사용자 ID
        },
      ]);
  };

  return <button onClick={handleSubmit}>게시글 작성</button>;
}
```

### 5. 프로필 업데이트 후 새로고침

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function UpdateProfile() {
  const { user, refreshProfile } = useAuth();

  const handleUpdate = async (newUsername: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id);

    if (error) {
      toast.error('프로필 업데이트 실패');
      return;
    }

    // 프로필 정보 새로고침
    await refreshProfile();
    toast.success('프로필이 업데이트되었습니다!');
  };

  return <button onClick={() => handleUpdate('new_username')}>프로필 업데이트</button>;
}
```

## 🔒 보호된 라우트 만들기

새로운 페이지를 보호하려면 `App.tsx`에서 `ProtectedRoute`로 감싸면 됩니다:

```tsx
import ProtectedRoute from './components/ProtectedRoute';
import MyNewPage from './pages/MyNewPage';

// App.tsx의 Routes 안에 추가
<Route
  path="/new-page"
  element={
    <ProtectedRoute>
      <MyNewPage />
    </ProtectedRoute>
  }
/>
```

## 📚 참고 파일

- `src/contexts/AuthContext.tsx` - 인증 컨텍스트
- `src/components/ProtectedRoute.tsx` - 보호된 라우트 컴포넌트
- `src/components/Navbar.tsx` - useAuth 사용 예제
- `src/pages/MyPage.tsx` - useAuth 사용 예제
- `src/pages/WritePage.tsx` - useAuth 사용 예제

## 💡 주의사항

1. `useAuth`는 반드시 `AuthProvider` 내부에서만 사용해야 합니다.
2. `loading`이 `true`인 동안은 `user`와 `profile`이 아직 로드되지 않은 상태입니다.
3. 프로필 정보를 업데이트한 후에는 `refreshProfile()`을 호출하여 최신 정보로 갱신하세요.
4. 보호된 페이지는 자동으로 로그인 체크를 하므로 별도의 체크가 필요 없습니다.
