// 루트 진입점 (Issue #29).
//
// docs/07-screens.md 74행: 「스플래시 · 온보딩 | 코드에 있음 | 04 에 대응하는 기능이
// 없다 — 앱 실행 화면이라 F 로 잡지 않았다」 — PRD 9개 확정 화면에 없는 부가 코드라
// 유지 의무가 없다. 완료조건 1(유효한 세션이 없으면 로그인 화면부터 표시)을 지연
// 없이 만족시키기 위해 세션 유무로 즉시 갈라 보낸다.
//
// auth()는 다른 보호 페이지(requireMe() 내부)가 이미 쓰는 것과 같은 Node 전용
// export다 — pendingSignup · withdrawPending 같은 세부 분기는 여기서 만들지 않는다.
// /home으로 보낸 요청은 auth.config.ts::authorized() 가 다시 판정하므로 중복
// 구현하지 않는다.

///


import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? '/home' : '/login');
}
