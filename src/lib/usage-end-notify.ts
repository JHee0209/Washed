// F9 종료 알림 — 사용중 → 수거대기로 실제 전환된 행에만 붙인다 (05 P26 · Issue #12).
//
// 이 전환은 두 곳에서 각각 훑는다 — expiration.ts::transitionFinishedUsageToPickup()
// (줄서기 POST · 하루 1회 배치)와 usage.ts::expireRunTimers()(GET /api/queue 폴링마다 ·
// 관리자 조회). 둘 다 같은 `WHERE q.status = '사용중'` 가드를 쓰므로 한 행은 둘 중
// 어느 한쪽에서만, 평생 한 번만 전환된다 — 동시에 실행돼도 Postgres 의 행 잠금이
// 직렬화하고, 먼저 커밋한 쪽의 RETURNING 에만 그 행이 잡힌다. 그래서 "RETURNING된
// 행에만 알림"이 곧 "중복 없음"이다.
//
// usage.ts(#7)와 expiration.ts(#8) 어느 쪽도 서로를 import하지 않도록 이 파일을
// 중립 지점으로 둔다 — 순환 import를 막는다.

import 'server-only';

import { notify } from '@/lib/notify';
import { usageEndedBody, usageEndedTitle } from '@/lib/notify-copy';

/**
 * 사용중 → 수거대기로 방금 전환된 큐 행 하나에 F9 알림을 준다. 실패해도 개별로
 * 잡는다(admin-actions.ts issueWarning · expiration.ts applySystemWarning 과 같은
 * 패턴) — 알림 실패가 전환 자체를 되돌리지 않는다.
 */
export async function notifyUsageEnded(userId: string, queueId: string, machineName: string): Promise<void> {
  try {
    await notify(userId, '종료', usageEndedTitle(machineName), usageEndedBody(machineName));
  } catch (error) {
    console.error('종료 알림 생성 실패', userId, queueId, error);
  }
}
