// 알림함 기록 + 폰 알림을 한 자리에서 만든다 (06 「알림」 · 05 P26).
//
// "허용하지 않았거나 구독이 끊긴 사람에게는 알림함에만 남는다 — 보낼 곳이 없을 뿐
// 기록은 똑같이 만든다"(P26) — 그래서 notifications INSERT 는 항상 하고,
// 푸시 발송은 그 뒤에 별도로(실패해도 알림함 기록에는 영향이 없게) 시도한다.

import 'server-only';

import { sql } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';

type NotificationKind = '공지' | '배정' | '종료' | '경고' | '결과';

/**
 * 알림을 누르면 갈 곳. 종류마다 다르다 — 배정 · 종료는 지금 무엇을 해야 하는지가
 * 홈에 있고(QR 인증 · 다했어요), 공지 · 경고 · 결과는 읽을 내용이 알림함에 있다.
 */
const DESTINATION: Record<NotificationKind, string> = {
  공지: '/notifications',
  경고: '/notifications',
  결과: '/notifications',
  배정: '/home',
  종료: '/home',
};

type NotifyOptions = {
  /** 이 공지가 나온 원본 (06 「공지」). 공지를 지우면 이 알림도 함께 사라진다(05 P18) */
  noticeId?: string;
  /**
   * 폰 알림까지 보낼지. 기본은 보낸다.
   *
   * [?] 「공지」는 팀 확인이 필요해 **기본을 끔**으로 두었다 — 05 P18 이 "알림함에
   * 자동으로 반영된다. 따로 발송하지 않는다" 이고, 08 · 12번이 푸시를 보내는 자리를
   * 배정 · 종료 · 경고 · 신고 결과 넷으로 열거하며 공지를 넣지 않았다. 반대로 05 P26 은
   * "알림은 폰 알림으로 보내는 것을 기본으로 한다" 이다. 팀이 보내기로 정하면
   * addNotice() 에서 이 값을 true 로 바꾸면 된다.
   */
  push?: boolean;
};

export async function notify(
  userId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  options: NotifyOptions = {},
): Promise<void> {
  const { noticeId = null, push = true } = options;

  await sql`
    INSERT INTO notifications (user_id, kind, title, body, notice_id)
    VALUES (${userId}, ${kind}, ${title}, ${body}, ${noticeId})
  `;

  if (!push) return;

  // 푸시는 best-effort 다 — 실패해도 위의 알림함 기록에는 영향이 없다(05 P26).
  await sendPushToUser(userId, { title, body, url: DESTINATION[kind] });
}
