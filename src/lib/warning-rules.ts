// 관리자 수동 경고 사유 규칙 (05 P6-1 · P16 · Issue #47 부속).
//
// **화면과 서버가 같은 사유 집합을 보게 하는 것이 이 파일의 존재 이유다**
// (src/lib/report-rules.ts 와 같은 패턴 · admin-actions.ts 는 'use server' 라
// async 함수만 내보낼 수 있어 여기 둔다).
//
// DB 저장값은 팀 확정(2026-09-17 · origin/fix/admin-warning-reason)의 짧은 이름을
// 그대로 쓰고, 화면에는 더 읽기 쉬운 문장을 보여준다. 둘이 다르므로 화면 라벨을
// 그대로 INSERT 하면 db/schema.sql 의 warnings.reason CHECK 에 걸린다.

/** 화면 라벨 → DB 저장값. db/schema.sql 의 warnings.reason CHECK 와 같은 값이어야 한다 */
export const ADMIN_WARNING_REASONS = [
  { value: '순서 미준수', label: '순서를 지키지 않았어요' },
  { value: '세탁물 방치', label: '세탁물이 있어요' },
] as const;

export type AdminWarningReasonValue = (typeof ADMIN_WARNING_REASONS)[number]['value'];

export function isAdminWarningReasonValue(value: string): value is AdminWarningReasonValue {
  return ADMIN_WARNING_REASONS.some((r) => r.value === value);
}

/**
 * DB 저장값 → 화면 라벨 (Issue #54 · 「경고 누적 사용자」 이력 표시).
 *
 * 관리자가 고를 수 있는 두 값(순서 미준수 · 세탁물 방치)만 더 읽기 쉬운 문장으로
 * 바꾼다. 시스템 자동 사유(배정 후 미인증 · 수거 미완료)와 예전 관리자 값
 * (신고 확인 · 더 이상 새로 고를 수 없지만 과거 행에 남아 있다)은 이미 그 자체로
 * 읽을 수 있는 한국어라 매핑이 없으면 DB 값을 그대로 보여준다.
 */
export function warningReasonLabel(value: string): string {
  return ADMIN_WARNING_REASONS.find((r) => r.value === value)?.label ?? value;
}
