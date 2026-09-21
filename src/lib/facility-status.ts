// 세탁실 전체 점검 상태 (05 P20 · 06 「세탁실」 · F22 · F33 · Issue #47).
//
// machines.status 의 '점검중'(admin-actions.ts::setMachineStatus)은 기기 단위다.
// 이건 완전히 다른 개념 — 세탁실 전체를 한 번에 잠그는 토글이며, facility_status
// 라는 별도 표(0010)에 산다. 서로 다른 표라 코드로도 서로를 덮어쓸 길이 없다.
//
// facility_status 는 항상 정확히 한 행이다(boolean PK + CHECK(id)) — 그래서 조회 ·
// 갱신 모두 경합이 없고, 몇 번을 반복 호출해도 안전하다(idempotent).

import 'server-only';
import { sql } from '@/lib/db';

export type FacilityStatus = { isUnderInspection: boolean };

/** 06 「세탁실」 읽기 — 관리자 대시보드(F22)와 /api/machines(F1)가 함께 쓴다 */
export async function getFacilityStatus(): Promise<FacilityStatus> {
  const rows = await sql<{ is_under_inspection: boolean }>`
    SELECT is_under_inspection FROM facility_status WHERE id = true
  `;
  return { isUnderInspection: rows[0]?.is_under_inspection ?? false };
}

/**
 * 세탁실 전체 점검 토글 (F33 · 05 P20).
 * UPDATE 한 줄이라 몇 번을 눌러도 안전하다 — 같은 값을 다시 넣어도 그냥 그 값으로
 * 남을 뿐 에러도, 중복 행도 생기지 않는다(표 자체가 항상 한 행).
 */
export async function updateFacilityInspection(next: boolean): Promise<FacilityStatus> {
  const rows = await sql<{ is_under_inspection: boolean }>`
    UPDATE facility_status SET is_under_inspection = ${next}
     WHERE id = true
    RETURNING is_under_inspection
  `;
  return { isUnderInspection: rows[0]?.is_under_inspection ?? next };
}
