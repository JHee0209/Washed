// Auth.js 가 쓰는 자리 — /api/auth/signin · /callback/google · /session · /signout 등.
// 이 파일이 없으면 구글 로그인 콜백이 돌아올 곳이 없다 (F38 · F39).
//
// Credentials 와 DB 를 쓰므로 Node 런타임이어야 한다 (엣지에는 scrypt · Neon 이 없다).

import { handlers } from '@/auth';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export const { GET } = handlers;

// Issue #29 — 「자동 로그인」 체크 해제 시 세션 쿠키를 브라우저 세션 쿠키로 바꾼다.
//
// Auth.js(@auth/core)는 로그인 시 쿠키의 Max-Age·Expires를 `session.maxAge`
// (auth.config.ts, 미설정 시 기본 30일) 하나로만 고정해서 찍는다 — authorize()나
// jwt 콜백이 무엇을 반환해도 이 계산에는 관여하지 못한다(콜백 반환값과
// 쿠키 만료 계산이 완전히 분리된 설계 — node_modules/@auth/core/src/lib/actions/
// callback/index.ts 확인). 그래서 콜백으로는 구현할 수 없고, Auth.js가 이미
// 만들어 응답에 실은 Set-Cookie 를 여기서 후처리한다.
//
// - credentials 콜백(/api/auth/callback/credentials) 이외의 모든 경로(구글 로그인
//   콜백 · signout · session · csrf 등)는 이 파일을 그대로 통과한다 — 손대지 않는다.
// - `remember` 폼 필드가 정확히 'false' 일 때만 세션 쿠키에서 Max-Age·Expires 만
//   지운다. 필드가 없거나 다른 값이면(기존 로그인 흐름과의 하위 호환) 기존 Auth.js
//   기본 동작(영속 쿠키) 그대로 둔다.
// - 건드리는 것은 `authjs.session-token`류 쿠키(운영 환경의 `__Secure-` 접두사 ·
//   4KB 초과 시 분할되는 `.0`·`.1` 청크 포함)뿐이다. csrf-token · callback-url 등
//   다른 Auth.js 쿠키, HttpOnly · Secure · SameSite · Path · Domain, 토큰 값 자체는
//   전혀 건드리지 않는다 — Max-Age/Expires 문구만 정규식으로 제거한다.
// - Set-Cookie 는 콤마로 합치면 안 되는 헤더라 `Headers.getSetCookie()`로 개별
//   읽어 개별 `append` 한다.
const SESSION_COOKIE_NAME = /^(__Secure-)?authjs\.session-token(\.\d+)?=/i;

function stripPersistence(setCookie: string): string {
  return setCookie.replace(/;\s*(Max-Age|Expires)=[^;]*/gi, '');
}

export async function POST(request: NextRequest): Promise<Response> {
  const { pathname } = new URL(request.url);
  const isCredentialsCallback = pathname === '/api/auth/callback/credentials';

  let remember = true;
  if (isCredentialsCallback) {
    try {
      // 원본 request 는 handlers.POST 가 그대로 읽어야 하므로 clone 에서만 읽는다.
      const form = await request.clone().formData();
      remember = form.get('remember') !== 'false';
    } catch {
      // 폼 파싱에 실패해도 로그인 자체를 막지 않는다 — 뒤에서 handlers.POST 가
      // 같은 request 로 다시 판단한다. 기존 기본 동작(영속 쿠키)으로 진행한다.
    }
  }

  const response = await handlers.POST(request);

  if (!isCredentialsCallback || remember) return response;

  const rewritten = new Headers(response.headers);
  rewritten.delete('set-cookie');
  for (const cookie of response.headers.getSetCookie()) {
    rewritten.append(
      'set-cookie',
      SESSION_COOKIE_NAME.test(cookie) ? stripPersistence(cookie) : cookie,
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: rewritten,
  });
}
