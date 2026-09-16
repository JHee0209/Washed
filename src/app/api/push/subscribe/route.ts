// F40 — 홈 첫 진입에서 알림을 허용하면 브라우저가 만들어 준 구독 정보를 저장한다.
// 06 「푸시 구독」 · 05 P26.
//
// POST { endpoint, keys: { p256dh, auth } }  →  { ok: true }
// DELETE { endpoint }                        →  { ok: true }   (허용을 취소했을 때)
//
// 구독은 기기 단위라 한 사람이 여러 기기를 쓰면 각각 저장한다(P26). endpoint 가
// 곧 그 기기라서 UNIQUE 이고, 같은 기기가 다른 계정으로 다시 구독하면 user_id 만
// 갈아 끼운다.

import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  // 05 P24 — 탈퇴 대기 계정에는 폰 알림을 새로 붙이지 않는다. (아래 DELETE 는 막지
  // 않는다 — 구독을 **거두는** 일까지 막을 이유가 없다.)
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const endpoint = typeof b.endpoint === 'string' ? b.endpoint : '';
  const keys = (b.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const authKey = typeof keys.auth === 'string' ? keys.auth : '';

  if (!endpoint || !p256dh || !authKey) {
    return Response.json({ ok: false, message: '구독 정보가 올바르지 않아요.' }, { status: 400 });
  }

  // 같은 기기가 다시 구독하면 열쇠가 새로 발급될 수 있다 — user_id 만 갈아 끼우고
  // 옛 열쇠를 두면 그 뒤 발송이 복호화되지 않는다. 셋 다 최신값으로 맞춘다.
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
    VALUES (${userId}, ${endpoint}, ${p256dh}, ${authKey})
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id    = EXCLUDED.user_id,
          p256dh_key = EXCLUDED.p256dh_key,
          auth_key   = EXCLUDED.auth_key
  `;

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const endpoint = typeof (body as Record<string, unknown>)?.endpoint === 'string'
    ? (body as Record<string, unknown>).endpoint as string
    : '';
  if (!endpoint) {
    return Response.json({ ok: false, message: '구독 정보가 올바르지 않아요.' }, { status: 400 });
  }

  // **본인 구독만** 지운다. endpoint 조건만으로 지우면 주소를 아는 사람이
  // 남의 기기 구독을 끊을 수 있다.
  await sql`
    DELETE FROM push_subscriptions
     WHERE endpoint = ${endpoint} AND user_id = ${userId}
  `;

  return Response.json({ ok: true });
}
