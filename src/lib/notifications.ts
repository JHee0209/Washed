// 알림함 (F17 · F18) — 06 「알림」 · 05 P14 · P18.
//
// 보관은 서버 배치가 지우고(src/lib/cleanup.ts · 08 · 9번) 여기서는 **조회**만 자른다 —
// 30일, 「공지」 종류만 3개월(P14 의 예외 · P18). 층이 다르므로 배치가 생긴 뒤에도
// 남겨 둔다: 배치는 하루 한 번 돌아 「기간이 지났지만 아직 안 지워진」 창이 최대 하루
// 생기는데, 그 하루 동안 지난 알림이 보이지 않게 하는 것이 이 필터다(05 의 [?]
// 「삭제 배치와 3개월 사이의 틈」).
//
// **두 층이 같은 날을 가리켜야 한다.** 예전에는 여기만 공지를 90일로 셌는데, 2월이 낀
// 구간에서 캘린더 3개월은 89일이라 삭제가 조회보다 짧아졌다 — 05 의 「조회가 보관보다
// 짧을 수는 있어도 길 수는 없다」를 어긴다. 그래서 양쪽 다 캘린더 3개월로 센다
// (배치 쪽은 src/lib/retention.ts 의 monthsAgo 가 같은 방식으로 끌어당긴다).

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

// 05 P14 — 30일, 「공지」만 3개월(P18).
//
// 기간은 아래 두 문장에 SQL interval 로 **똑같이** 적혀 있다. 태그드 템플릿은 값만
// 매개변수로 내보내므로(db.ts) interval 식을 상수로 빼서 끼워 넣을 수 없다 — 그렇게
// 하면 SQL 이 아니라 문자열 하나가 들어간다. 그래서 두 곳에 같은 식을 적고, 한쪽만
// 고치는 일이 없도록 이 주석을 둔다(목록과 종 아이콘 개수가 어긋나면 안 된다).
//
// 삭제 쪽 숫자는 src/lib/retention.ts 에 있고, monthsAgo 가 여기의 interval '3 months'
// 와 같은 날을 가리키도록 월말을 끌어당긴다.

export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  return sql<NotificationRow>`
    SELECT notification_id, kind, title, body, is_read, received_at
      FROM notifications
     WHERE user_id = ${userId}
       AND received_at >= now() - CASE WHEN kind = '공지'
                                       THEN interval '3 months'
                                       ELSE interval '30 days'
                                  END
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
       AND received_at >= now() - CASE WHEN kind = '공지'
                                       THEN interval '3 months'
                                       ELSE interval '30 days'
                                  END
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
