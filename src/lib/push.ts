// 저장된 구독으로 실제 폰 알림을 보낸다 — 앱 코드 쪽. 06 「푸시 구독」 · 05 P26.
//
// scripts/dev-push.mjs 와 로직이 같다. 스크립트는 Next 의 경로 별칭 없이 plain
// node 로 도는 개발 전용 도구라 따로 두었다(dev-user.mjs 가 src/lib/hash.ts 를
// 옮겨 쓴 것과 같은 이유) — 여기는 F5 · F9 · F31 이 알림을 만드는 자리(src/lib/notify.ts)가
// 쓰는 앱 런타임 코드다.

import 'server-only';
import webpush from 'web-push';

import { sql } from '@/lib/db';

type PushPayload = { title: string; body: string; url?: string };

function configured() {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

/**
 * 이 사람의 모든 기기 구독으로 보낸다(P26 — 구독은 기기 단위라 여러 개일 수 있다).
 * 보내다 실패한 구독은 지운다. 구독이 하나도 없어도 에러를 던지지 않는다 —
 * 알림함 기록(notifications)은 허용 여부와 무관하게 남아야 하기 때문이다(P26).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured()) return;

  const subs = await sql<{
    push_subscription_id: string;
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
  }>`
    SELECT push_subscription_id, endpoint, p256dh_key, auth_key
      FROM push_subscriptions
     WHERE user_id = ${userId}
  `;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      };
      try {
        await webpush.sendNotification(subscription, body);
        await sql`
          UPDATE push_subscriptions SET last_success_at = now()
           WHERE push_subscription_id = ${sub.push_subscription_id}
        `;
      } catch (error) {
        // 06 「푸시 구독」의 "보내다 실패하면 지운다" 는 **구독이 죽은 경우**를 말한다.
        //
        // 브라우저의 푸시 서비스는 구독이 폐기됐을 때 404 · 410 을 준다. 그 밖의
        // 실패(네트워크 순단 · FCM 5xx · 429)는 구독이 아니라 **이번 발송**이 실패한
        // 것이라, 여기서 지우면 사용자는 아무 잘못 없이 알림이 끊긴다. 허용은
        // 홈 첫 진입에서 한 번만 묻기 때문에(05 P26) 되돌릴 길도 설정 화면뿐이다.
        const status = (error as { statusCode?: number })?.statusCode;
        const gone = status === 404 || status === 410;

        if (gone) {
          console.error('푸시 구독이 폐기됨 — 지움', sub.endpoint, status);
          await sql`DELETE FROM push_subscriptions WHERE push_subscription_id = ${sub.push_subscription_id}`;
        } else {
          // 일시적인 실패다. 구독은 남기고 다음 발송을 기다린다.
          console.error('푸시 발송 실패 — 구독은 유지', sub.endpoint, status ?? error);
        }
      }
    }),
  );
}
