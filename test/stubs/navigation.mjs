// `next/navigation` 대체 — redirect() 하나뿐이다 (Issue #86).
//
// src/lib/admin-session.ts 의 requireAdmin() 은 관리자가 아니면 redirect('/admin/login')
// 으로 돌려보낸다. 진짜 redirect() 는 Next 가 렌더 도중 잡아채는 특수 예외를 던지므로
// node --test 에서 그대로 부르면 의미를 알 수 없는 오류가 된다.
//
// **판정은 그대로 둔다** — 여기서는 "돌려보냈다" 를 알아볼 수 있는 오류로 바꿔 던지기만
// 한다. 관리자 검사가 빠져도 테스트가 조용히 통과하는 일이 없게 하려는 것이다.

export function redirect(url) {
  const error = new Error(`NEXT_REDIRECT: ${url}`);
  error.digest = `NEXT_REDIRECT;${url}`;
  throw error;
}
