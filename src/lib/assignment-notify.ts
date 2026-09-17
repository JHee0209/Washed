// 배정 알림 — drainQueue() 가 돌려준 배정 결과마다 notify('배정', …) 를 붙인다
// (F4 · F5 · 05 P26 · Issue #12 — 08 · 12번 「배정(F5) … 폰 알림도 함께 나간다」).
//
// drainQueue() 의 호출부 넷(api/queue/[kind] POST · api/queue/finish POST ·
// admin-actions.ts 의 setMachineStatus · cancelQueue) 이 저마다 같은 반복문을
// 두면 문구가 갈릴 수 있어 한 곳에 모은다. drainQueue() 자체(Issue #5)는 건드리지
// 않는다 — 배정 판정이 이미 끝난 결과만 받아 알릴 뿐이다.
//
// 중복 걱정이 없는 이유 — drainQueue() 의 assigned CTE 는 `WHERE q.status = '대기 중'`
// 로 잠긴 행만 배정하므로, 한 큐 행은 평생 이 배열에 정확히 한 번만 등장한다
// (assignment.ts 머리말). 그 결과에 대해서만 알리므로 같은 사건이 두 번 알림 가지
// 않는다.

import 'server-only';

import type { Assignment } from '@/lib/assignment';
import { notify } from '@/lib/notify';
import { assignmentBody, assignmentTitle, type AssignmentNotifyVariant } from '@/lib/notify-copy';

/**
 * variant 는 호출부가 정한다(개별 배정 사유가 아니라 "이 요청이 무엇을 하다가
 * 배정을 만들었는가" 기준) — instant: 줄서는 그 자리에서 곧바로 배정(F4).
 * turn: 앞사람 종료 · 관리자 동작으로 이미 기다리던 차례가 옴(F5).
 *
 * 실패는 각자 잡는다 — 한 사람의 알림이 실패해도 나머지에게는 계속 보낸다
 * (05 P26 · expiration.ts applySystemWarning() 과 같은 판단: 알림 실패가 배정 자체를
 * 되돌리지 않는다).
 */
export async function notifyAssignments(
  assignments: Assignment[],
  variant: AssignmentNotifyVariant,
): Promise<void> {
  for (const a of assignments) {
    try {
      await notify(a.user_id, '배정', assignmentTitle(a.machine_name), assignmentBody(a.machine_name, variant));
    } catch (error) {
      console.error('배정 알림 생성 실패', a.user_id, a.machine_id, error);
    }
  }
}
