// `@/auth` 대체 — 라우트 핸들러에게 "지금 로그인한 사람" 만 알려준다 (Issue #58).
//
// 라우트(POST /api/queue/[kind] · verify-qr · finish)는 전부 `const session = await auth()`
// 로 시작한다. NextAuth 본체는 AUTH_SECRET · 구글 provider 설정이 있어야 초기화되고
// HTTP 요청 컨텍스트를 요구해서 node --test 에서 그대로 부를 수 없다.
//
// **여기서 정하는 것은 세션뿐이다** — 줄서기 게이트 SQL · 배정 · QR · 종료 판정은
// 하나도 건드리지 않는다. `withdrawPendingBlock(session)` 이 보는 `withdrawPending`
// 도 세션 값이라 같은 자리에서 준다.

/** @type {{ user: { id: string }, withdrawPending?: boolean } | null} */
let session = null;

/**
 * 다음 라우트 호출이 어느 사용자로 실행될지 정한다.
 * `null` 을 넘기면 비로그인 상태가 된다(라우트는 401 을 돌려준다).
 */
export function setTestSession(next) {
  session = next;
}

/** 로그인한 사용자 한 명으로 세션을 채우는 지름길 */
export function loginAs(userId) {
  session = { user: { id: userId } };
}

/** NextAuth 의 `auth()` 자리 */
export async function auth() {
  return session;
}
