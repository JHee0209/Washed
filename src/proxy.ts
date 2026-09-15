// 로그인하지 않은 사람을 막는 자리.
//
// **Next.js 16 에서 `middleware.ts` 가 `proxy.ts` 로 이름이 바뀌었다.**
// Auth.js v5 문서의 「Migrating to v5」에도 같은 내용이 있다 — v4 시절 글을 보고
// middleware.ts 를 만들면 아무 일도 일어나지 않으니 주의한다.
//
// 여기서는 **쿠키에 든 JWT 만 읽는다** — DB 를 만지지 않는다.
// 판정 규칙은 auth.config.ts 의 authorized 콜백 한 곳에만 있다.
// (auth.ts 를 부르면 Neon 드라이버와 scrypt 가 딸려 와 엣지에서 터진다.)

import NextAuth from 'next-auth';

import { authConfig } from '@/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // 정적 파일 · 이미지 · Auth.js 자신의 라우트는 지나치게 한다.
  // /api/auth/* 를 걸면 로그인 콜백이 자기 자신에게 막힌다.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|icons|.*\\.png$).*)'],
};
