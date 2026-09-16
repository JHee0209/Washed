// 이용 제한 자동 해제 · 매달 1일 경고 초기화 (05 P7 · 08 · 4번).
//
// P3(배정 10분)·P5(수거 3분) 만료 스윕은 여기 없다 — #4(줄서기 API)·#5(배정
// 서버화)가 queue 에 실제 배정 데이터를 쓰기 시작한 뒤에 이어서 만든다. 지금은
// queue 행을 만드는 API 자체가 없어 그 스윕을 만들어도 검증할 데이터가 없다.
//
// db/schema.sql 의 usage_restrictions 테이블 주석이 이 자리를 정확히 가리킨다:
// "제한 3일 종료를 처리하는 서버 스케줄러가 훑는 자리 (05 P7 · 08 · 4번)".

import 'server-only';

import { sql } from '@/lib/db';
import { isFirstOfMonthInKst } from '@/lib/kst-date';

/**
 * 05 P7 — 3일 제한이 끝난 사람을 훑어 경고를 0회로 초기화한다.
 *
 * admin-actions.ts 의 clearRestriction()(관리자 수동 해제, F25)과 **같은 최종
 * 상태**로 맞춘다. 조건부 UPDATE 라 이미 풀린 행은 다시 걸리지 않는다 — 스케줄러가
 * 여러 번 돌아도 결과가 깨지지 않는다.
 */
export async function liftExpiredRestrictions(now: Date = new Date()): Promise<number> {
  const rows = await sql<{ user_id: string }>`
    UPDATE usage_restrictions
       SET warning_count = 0, restricted_from = NULL, restricted_until = NULL
     WHERE restricted_until IS NOT NULL
       AND restricted_until <= ${now.toISOString()}::timestamptz
    RETURNING user_id
  `;
  return rows.length;
}

/**
 * 05 P7 — 매달 1일(KST)에 전원 경고를 0회로 초기화한다.
 *
 * "확인할 수 없어 표시해 둔 것"의 팀 확정: 제한 3일 종료 초기화와 매달 1일 초기화
 * 둘 다 유지한다 — 월말에 경고를 받아 제한 중이어도 1일이 되면 0회로 돌아간다.
 * 그래서 liftExpiredRestrictions 와 같은 최종 상태(0/NULL/NULL)로 리셋한다.
 *
 * 1일이 아니면 아무것도 하지 않는다. 같은 날 여러 번 돌아도 이미 0인 행은
 * 다시 바뀌지 않아 idempotent 하다.
 */
export async function resetMonthlyWarnings(now: Date = new Date()): Promise<number> {
  if (!isFirstOfMonthInKst(now)) return 0;

  const rows = await sql<{ user_id: string }>`
    UPDATE usage_restrictions
       SET warning_count = 0, restricted_from = NULL, restricted_until = NULL
     WHERE warning_count > 0
        OR restricted_from IS NOT NULL
        OR restricted_until IS NOT NULL
    RETURNING user_id
  `;
  return rows.length;
}
