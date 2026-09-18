// F17 — 알림 읽음 처리
// POST { notificationId } | { all: true }  →  { ok: true }

import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { markAllRead, markRead } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });

  // 05 P24 — 탈퇴 대기 중에는 쓰지 않는다 (알림함 조회는 그대로 열려 있다).
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  if (b.all === true) {
    await markAllRead(userId);
    return Response.json({ ok: true });
  }

  if (typeof b.notificationId !== 'string') {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  await markRead(userId, b.notificationId);
  return Response.json({ ok: true });
}
