// Auth.js 의 useSession 을 쓰려면 이 감싸개가 있어야 한다.
// SessionProvider 자체는 클라이언트 컴포넌트라, 서버 컴포넌트인 layout.tsx 에서
// 바로 쓸 수 없어 한 겹 둔다.

'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export default function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
