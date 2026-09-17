// 경고 사유 규칙 (05 P6-1 · P16 · 0009).
//
// admin-actions.ts 는 'use server' 파일이라 **async 함수 말고는 내보낼 수 없다.**
// 화면(admin/tabs.tsx)과 서버 액션이 같은 목록을 봐야 하므로 여기 따로 둔다 —
// assignment-rules.ts · report-rules.ts 와 같은 자리다.

/**
 * 관리자가 **직접 판단해서** 줄 수 있는 경고 사유 (2026-09-17 팀 확정).
 *
 * 배정 후 미인증(P3) · 수거 미완료(P5)는 서버가 시각으로 판정하는 것이라 여기 없다 —
 * 관리자가 같은 사건을 손으로 다시 넣을 일이 없어야 한다(expiration.ts 가 찍는다).
 * '신고 확인' 은 예전 관리자 값이라 DB CHECK 에는 남아 있지만 새로 고를 수는 없다.
 */
export const ADMIN_WARNING_REASONS = ['순서 미준수', '세탁물 방치'] as const;

export type AdminWarningReason = (typeof ADMIN_WARNING_REASONS)[number];

export function isAdminWarningReason(value: string): value is AdminWarningReason {
  return (ADMIN_WARNING_REASONS as readonly string[]).includes(value);
}
