// 알림함 목록 (F17 · 06 「알림」)
//
// GET /api/notifications  →  { ok: true, items: NotificationRow[] }
//
// 화면(src/app/(user)/notifications/page.tsx)이 'use client' 라 lib/notifications.ts 를
// 직접 부를 수 없다 — 그쪽은 db.ts 를 거쳐 'server-only' 라 클라이언트 번들에
// 들어가면 빌드가 깨진다. 그래서 읽는 길을 라우트로 낸다.
//
// 보관 기간(30일 · 「공지」만 3개월 · 05 P14 · P18)은 lib/notifications.ts 한 곳에만
// 있다. 여기서 다시 자르지 않는다.

import { auth } from '@/auth';
import { getNotifications } from '@/lib/notifications';

export const runtime = 'nodejs';
// 줄서기 현황과 같은 이유로 캐시하지 않는다 — 방금 온 알림이 보여야 한다.
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  const items = await getNotifications(userId);

  return Response.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}
