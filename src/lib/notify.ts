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
   * 알림함에 보일 「받은 시각」. 안 넘기면 DB 의 now() 를 쓴다 (06 「받은 시각」).
   *
   * **경고 알림만 이 값을 넘긴다 (Issue #65).** 경고는 `warnings.issued_at` 이 곧
   * "사용자가 실제로 경고를 받은 시각"이고 관리자 화면(F25)·이용기록(F13)이 그 값을
   * 그대로 보여주므로, 알림함도 같은 값을 써야 한 사건이 세 화면에서 같은 시각으로
   * 보인다. 경고 INSERT 와 이 INSERT 는 **별개의 문장**이라(neon-http — 한 문장이 곧
   * 한 트랜잭션 · db.ts) 각자 now() 를 부르면 두 시각이 갈린다.
   *
   * 배정 · 종료 · 공지 같은 일반 알림은 넘기지 않는다 — 그 알림들은 만들어진 시각이
   * 곧 받은 시각이라 DB now() 가 정답이다(기존 동작 그대로).
   *
   * **반드시 DB 가 `::text` 로 내보낸 문자열이어야 한다** — `Date` 는 받지 않는다.
   * 이 저장소의 드라이버는 timestamptz(OID 1184)를 pg-types 의 parseDate 로 JS Date 에
   * 담아 주는데, Date 는 밀리초까지만 표현해 마이크로초가 잘린다. 한 번 Date 를 거친
   * 값은 이미 정보를 잃은 뒤라 여기서 되살릴 수 없다(실측 -621µs).
   */
  receivedAt?: string;
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
  const { noticeId = null, push = true, receivedAt = null } = options;

  // expiration.ts::transitionUsageToPickup() 의 `COALESCE(${...}::timestamptz, now())`
  // 와 같은 관용구다 — 넘긴 값이 있으면 그 시각, 없으면 DB 시각 하나로 갈린다.
  // 값을 JS 로 변환하지 않고 **문자열 그대로** 돌려보낸다(마이크로초 보존).
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, notice_id, received_at)
    VALUES (${userId}, ${kind}, ${title}, ${body}, ${noticeId},
            COALESCE(${receivedAt}::timestamptz, now()))
  `;

  if (!push) return;

  // 푸시는 best-effort 다 — 실패해도 위의 알림함 기록에는 영향이 없다(05 P26).
  await sendPushToUser(userId, { title, body, url: DESTINATION[kind] });
}
