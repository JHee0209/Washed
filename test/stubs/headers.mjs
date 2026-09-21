// `next/headers` 대체 — 쿠키 통 하나뿐이다 (Issue #86).
//
// src/lib/admin-session.ts 는 `cookies()` 로 관리자 쿠키(washed-admin)를 읽고 쓴다.
// 진짜 구현은 Next 의 요청 컨텍스트(AsyncLocalStorage) 안에서만 돌아서 node --test
// 에서는 부를 수 없다.
//
// **여기서 정하는 것은 쿠키 값뿐이다** — 서명 · 만료 · 권한 판정은 하나도 건드리지
// 않는다. 테스트는 admin-session 의 adminSignIn() 을 그대로 불러 쿠키를 얻으므로,
// 서명이 틀리면 requireAdmin() 은 테스트에서도 똑같이 막힌다
// (test/stubs/auth.mjs 가 사생 세션에 대해 하는 일과 같은 성격이다).

const store = new Map();

/** 테스트 사이에 쿠키 통을 비운다 (로그아웃 상태로 되돌린다) */
export function clearTestCookies() {
  store.clear();
}

/** Next 의 `cookies()` 자리 */
export async function cookies() {
  return {
    get(name) {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name, value) {
      // 세 번째 인자(httpOnly · maxAge …)는 브라우저가 볼 것이라 테스트에서는 버린다.
      store.set(name, value);
    },
    delete(name) {
      store.delete(name);
    },
  };
}
