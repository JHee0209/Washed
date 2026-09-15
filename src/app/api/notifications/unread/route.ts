// 안 읽은 알림 수 (F18) — 상단 바 종에 붙는 점.
//
// GET /api/notifications/unread  →  { ok: true, count: number }
//
// 홈 · 기록 · 설정 세 화면이 모두 'use client' 라 서버에서 값을 내려줄 수 없어
// 이 길로 읽는다. 세 화면이 같은 훅(useUnreadCount)을 쓰므로 계산은 한 곳이다.
//
// 보관 기간 필터는 lib/notifications.ts 의 getUnreadCount 가 목록과 **같은 규칙**으로
// 적용한다 (05 P14 — 30일 · 「공지」만 3개월). 목록과 개수가 어긋나면 안 된다.

import { auth } from '@/auth';
import { getUnreadCount } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  const count = await getUnreadCount(userId);

  return Response.json({ ok: true, count }, { headers: { 'Cache-Control': 'no-store' } });
}
