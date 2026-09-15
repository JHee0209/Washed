// 알림함 (F17 · F18) — 06 「알림」 · 05 P14 · P18.
//
// 보관은 서버 배치가 지우는 것이고(08 · 9번, 아직 없다) 여기서는 **조회**만 자른다 —
// 30일, 「공지」 종류만 3개월(P14 의 예외 · P18). 배치가 생기면 이 필터는 남겨도 되고
// 빼도 된다(지워진 것은 어차피 안 보인다).

import 'server-only';

import { sql } from '@/lib/db';

export type NotificationKind = '공지' | '배정' | '종료' | '경고' | '결과';

export type NotificationRow = {
  notification_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  is_read: boolean;
  received_at: string;
};

/** 05 P14 — 30일. 단 「공지」만 3개월(P18). */
const KEEP_DAYS_DEFAULT = 30;
const KEEP_DAYS_NOTICE = 90;

export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  return sql<NotificationRow>`
    SELECT notification_id, kind, title, body, is_read, received_at
      FROM notifications
     WHERE user_id = ${userId}
       AND received_at >= now() - make_interval(days =>
             CASE WHEN kind = '공지' THEN ${KEEP_DAYS_NOTICE}::int ELSE ${KEEP_DAYS_DEFAULT}::int END)
     ORDER BY received_at DESC
  `;
}

/** 종 아이콘의 점 (F18) — 상단 바가 있는 세 화면이 모두 쓴다 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await sql<{ n: number }>`
    SELECT count(*)::int AS n
      FROM notifications
     WHERE user_id = ${userId}
       AND is_read = false
       AND received_at >= now() - make_interval(days =>
             CASE WHEN kind = '공지' THEN ${KEEP_DAYS_NOTICE}::int ELSE ${KEEP_DAYS_DEFAULT}::int END)
  `;
  return row?.n ?? 0;
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await sql`
    UPDATE notifications SET is_read = true
     WHERE user_id = ${userId} AND notification_id = ${notificationId}
  `;
}

export async function markAllRead(userId: string): Promise<void> {
  await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND is_read = false`;
}
