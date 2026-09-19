// 만료 스케줄러의 **실행 순서** (05 P3 · P5 · P7 · 08 · 4번 · Issue #8).
//
// 08 · 4번: 「화면이 켜져 있어야 만료가 처리된다」 → 「**서버 스케줄러**가 처리한다」
//           「**앱을 안 켠 사람도 경고를 받아야 한다.**」
//
// 이 파일이 그 문장을 끝낸다. 지금까지 배정 10분 만료와 수거 3분 초과는
//   · POST /api/queue/[kind] — 누군가 줄을 설 때만 (지연평가)
//   · POST /api/queue/sweep  — 홈 화면이 열려 있을 때 5초마다, 그나마 사용중 → 수거대기만
//   · GET  /api/cron/cleanup — 하루 1회(03:00 KST) 백스톱
// 이 세 경로에서만 돌았다. 아무도 앱을 켜지 않으면 최대 하루가 지나야 경고가 남는다.
//
// ── 이 파일은 판정을 하지 않는다
// **SQL 을 한 줄도 갖지 않는다.** 스윕 함수는 전부 expiration.ts 에 이미 있고
// (Issue #8 이전부터), 배정은 assignment.ts 의 drainQueue() 가 한다. 여기서는 그것들을
// **어떤 순서로 부를지**만 정한다 — 같은 판정을 새로 구현하면 정책이 두 곳으로 갈린다
// (#34 가 expireRunTimers() 에 했던 정리와 같은 이유).
//
// ── 부르는 곳 둘
//   · GET /api/cron/expiration — 주기 스케줄러 (이 파일의 본래 목적)
//   · runDailyCleanup()        — 하루 1회 배치가 같은 순서를 그대로 쓴다
// 순서를 두 곳에 적지 않기 위해 cleanup.ts 도 이 함수를 부른다.

import 'server-only';

import { drainQueue } from '@/lib/assignment';
import { notifyAssignments } from '@/lib/assignment-notify';
import {
  expireOverdueAssignments,
  expireOverduePickups,
  liftExpiredRestrictions,
  transitionFinishedUsageToPickup,
} from '@/lib/expiration';

export type ExpirationSweepResult = {
  /** 05 P3 — 10분 안에 QR 인증이 없어 배정이 풀리고 경고가 매겨진 건수 */
  expiredAssignments: number;
  /** 05 P5 · F9 — 사용 타이머가 끝나 수거대기로 넘어간 건수 */
  startedPickupWaits: number;
  /** 05 P5 — 수거대기 3분을 넘겨 강제 종료·경고가 매겨진 건수 */
  expiredPickups: number;
  /** 05 P2 — 위에서 풀린 기기에 FIFO 로 새로 배정된 사람 수 */
  assignedNext: number;
  /** 05 P7 — 3일 제한이 끝나 경고 0회로 자동 해제된 사람 수 */
  liftedRestrictions: number;
  /** 실패한 단계의 이름. 비어 있으면 전부 성공이다 */
  failed: string[];
};

/**
 * 만료 스윕 한 회차 (05 P3 · P5 · P7).
 *
 * ── 순서와 그 이유
 *  1. `expireOverdueAssignments` — 배정 10분 초과. 기기를 **푼다**.
 *  2. `transitionFinishedUsageToPickup` — 사용중 → 수거대기 (#34 가 단일화한 구현).
 *  3. `expireOverduePickups` — 수거 3분 초과. 기기를 **푼다**.
 *  4. `drainQueue` — 1·3 에서 풀린 기기에 다음 대기자를 배정한다.
 *  5. `liftExpiredRestrictions` — 3일 제한 종료.
 *
 * **2 → 3 순서**: 늦게 도는 회차가 한 번에 두 상태를 모두 지나칠 수 있게 한다 —
 * 타이머도 끝나고 3분도 이미 지났으면 이 회차 안에서 수거대기를 거쳐 곧바로 강제
 * 종료까지 간다(cleanup.ts 가 원래 쓰던 근거 그대로).
 *
 * **4 는 맨 뒤에서 한 번만**: 기기를 푸는 단계(1·3)가 모두 끝난 뒤 딱 한 번 drain
 * 하므로 이 회차에서 queue 가 두 칸 진행될 여지가 없다. 단계마다 부르면 같은 tick
 * 안에서 배정이 두 번 일어난다. drainQueue() 자체도 한 문장/한 트랜잭션이라
 * (assignment.ts), 스케줄러가 거의 동시에 두 번 들어와도 한 queue 행은 정확히
 * 한 번만 배정된다 — `WHERE q.status = '대기 중'` + `FOR UPDATE` 가 그것을 지키고
 * 마지막 방어선은 queue_machine_once_idx 다.
 *
 * **5 는 다른 단계와 상태를 나눠 쓰지 않아** 순서에 의존하지 않지만, 이 회차에서
 * 새로 걸린 3회 제한(restricted_until = now + 3일)을 같은 회차에서 곧바로 풀어
 * 버리지 않는다는 의도를 순서로 못박아 둔다.
 *
 * **`resetMonthlyWarnings()` 는 여기 없다.** 05 P7 의 "매달 1일 초기화" 는 하루 1회를
 * 뜻한다 — 이 스윕은 분 단위로 돌 수 있어서, 여기 넣으면 1일 하루 내내 매 회차마다
 * 누적을 0 으로 밀어 **그날 새로 쌓인 경고까지 지워 버린다**. 그래서 하루 1회 배치
 * (cleanup.ts · 03:00 KST)에 그대로 둔다.
 *
 * 한 단계가 실패해도 다음 단계는 돈다 — 배정 만료가 막혔다고 제한 해제까지 멈추면
 * 05 P7 의 "3일" 이 조용히 늘어난다. 실패한 단계 이름은 failed 에 모아 라우트가
 * 500 으로 알린다(cleanup.ts 의 step() 과 같은 방식).
 */
export async function runExpirationSweep(now: Date = new Date()): Promise<ExpirationSweepResult> {
  const result: ExpirationSweepResult = {
    expiredAssignments: 0,
    startedPickupWaits: 0,
    expiredPickups: 0,
    assignedNext: 0,
    liftedRestrictions: 0,
    failed: [],
  };

  /** 한 단계를 돌린다. 실패하면 이름만 남기고 다음으로 넘어간다. */
  async function step(name: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      console.error(`만료 스케줄러 단계 실패: ${name}`, error);
      result.failed.push(name);
    }
  }

  // 1. 05 P3 — 배정 후 10분 안에 QR 인증이 없으면 배정을 풀고 '배정 후 미인증' 경고.
  await step('expiredAssignments', async () => {
    result.expiredAssignments = await expireOverdueAssignments(now);
  });

  // 2. 05 P5 · F9 — 사용 타이머가 끝난 줄을 수거대기로 옮긴다(#34 단일 구현).
  await step('startedPickupWaits', async () => {
    result.startedPickupWaits = await transitionFinishedUsageToPickup(now);
  });

  // 3. 05 P5 — 수거 마감(타이머 0 + 3분)을 넘기면 강제 종료하고 '수거 미완료' 경고.
  await step('expiredPickups', async () => {
    result.expiredPickups = await expireOverduePickups(now);
  });

  // 4. 05 P2 — 1·3 에서 풀린 기기에 FIFO 로 다음 대기자를 넣는다. 지금까지 이 걸음이
  //    없어서, 하루 1회 배치는 기기를 풀어 놓고도 다음 사람을 배정하지 않았다
  //    (drainQueue() 호출부에 cleanup.ts 가 없었다). 배정 알림은 '차례가 왔다' 쪽이다
  //    — 줄을 서는 그 자리에서 곧바로 받은 배정(instant)이 아니라 기다리던 차례다.
  await step('assignedNext', async () => {
    const assigned = await drainQueue();
    result.assignedNext = assigned.length;
    if (assigned.length > 0) {
      await notifyAssignments(assigned, 'turn');
    }
  });

  // 5. 05 P7 — 3일이 지난 이용 제한을 풀고 경고를 0회로 되돌린다.
  await step('liftedRestrictions', async () => {
    result.liftedRestrictions = await liftExpiredRestrictions(now);
  });

  return result;
}
