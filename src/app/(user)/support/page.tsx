// F21 문의하기 — 로그인한 사람만 들어온다 (Issue #86).
//
// 이름 · 아이디(이메일)를 사용자가 직접 타이핑하던 화면이었다. 저장은 세션 사용자
// 기준으로만 해야 하므로(누구나 남의 이름으로 문의할 수 있으면 안 된다), 값을 서버에서
// 내려 주고 화면은 읽기 전용으로 보여 준다 — src/app/(user)/settings/page.tsx 와 같은 구조다.

import SupportClient from './support-client';
import { requireMe } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const me = await requireMe();
  return <SupportClient name={me.name} email={me.email} />;
}
