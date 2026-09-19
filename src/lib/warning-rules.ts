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

// ── 경고가 가리키는 "사건" (05 P6 · 0008 · 0012 · Issue #8)
//
// 05 P6 은 같은 사건에 경고가 두 번 붙지 않게 하라고 하고, 08 · 4번은 그것을
// 「자동 판정과 관리자 수동 부여가 같은 건에 두 번 붙지 않도록 **서버에서** 막는다」로
// 적었다. 서버가 막으려면 관리자도 **어느 사건인지** 함께 보내야 한다 — 사유만으로는
// 다른 날 · 다른 이용 건의 같은 사유와 구분할 수 없기 때문이다.
//
// 사건을 고르는 **화면**은 둘이지만, 사건의 **이름은 하나**다 (0013).
//   · queue — 아직 진행 중인 줄서기 한 줄. 그 queue_id 가 곧 사건 이름이다.
//   · usage — 이미 끝난 이용 한 건. 그 행의 source_queue_id 가 원래 사건 이름이라,
//     서버가 되짚어 같은 값을 쓴다.
// 그래서 어느 화면에서 시작하든 경고는 **같은 canonical 키**
// (warnings.incident_queue_id · 0012)를 향해 INSERT 되고, 부분 UNIQUE 하나가 순서와
// 무관하게 중복을 막는다. 0013 이전 이용 내역만 source_queue_id 가 없어
// warnings.usage_history_id(0008)로 보호된다.

/** 경고를 매길 대상 사건. 어느 표의 어느 행인지로만 이루어진다 */
export type WarningIncidentRef = {
  kind: 'queue' | 'usage';
  id: string;
};

/**
 * 런타임 검증 — 서버 액션의 인자는 **클라이언트 입력**이라 타입만 믿을 수 없다.
 *
 * 모르는 kind 를 queue 로 넘겨짚지 않는다 — 그러면 엉뚱한 표의 uuid 가 사건 키로
 * 들어가 중복 검사가 조용히 빗나간다. 모양이 아니면 거절하는 쪽이 안전하다.
 */
export function isWarningIncidentRef(value: unknown): value is WarningIncidentRef {
  if (!value || typeof value !== 'object') return false;
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (kind !== 'queue' && kind !== 'usage') return false;
  return typeof id === 'string' && id.length > 0;
}

/** 관리자가 고를 수 있는 사건 한 줄 — 사건 참조에 화면용 정보를 붙인 것 */
export type WarningIncidentOption = WarningIncidentRef & {
  label: string;
  already_warned: boolean;
};

/**
 * 05 P6-1 — 시스템이 자동으로 부여하는 경고 사유.
 *
 * db/schema.sql 의 warnings.reason CHECK 부분집합이고, expiration.ts 의
 * applySystemWarning() 이 쓰는 타입도 여기서 나온다 — 두 곳에 적어 두면 한쪽만
 * 고쳐질 수 있어서다(신고 확인 · 순서 미준수 · 세탁물 방치는 관리자 전용이라 없다).
 */
export const SYSTEM_WARNING_REASONS = ['배정 후 미인증', '수거 미완료'] as const;

export type SystemWarningReason = (typeof SYSTEM_WARNING_REASONS)[number];

/**
 * 05 P6 — 이 사유로 주는 관리자 경고는 **사건을 반드시 골라야 한다.**
 *
 * 스케줄러가 같은 사유로 같은 사건에 자동 경고를 매기므로, 사건을 지정하지 않으면
 * 서버가 두 경고를 비교할 근거 자체를 갖지 못해 중복을 막을 수 없다 — 사건 없이
 * 허용하면 그 길로 P6 이 통째로 비켜간다.
 *
 * 신고 확인 · 순서 미준수 · 세탁물 방치는 자동 판정이 없는 사유라 예전처럼 사건
 * 없이도 줄 수 있다(F29 의 일반 경고).
 */
export function requiresWarningIncident(reason: string): boolean {
  return (SYSTEM_WARNING_REASONS as readonly string[]).includes(reason.trim());
}

/**
 * `<select>` 의 값처럼 문자열 하나로 주고받을 때 쓰는 표기 (`"usage:<uuid>"`).
 *
 * 화면과 서버가 같은 표기를 보게 하려고 여기 둔다 — 이 파일의 존재 이유와 같다.
 * 사건을 고르지 않았을 때는 빈 문자열이고, 그때는 예전처럼 사건 없는 경고가 된다.
 */
export function encodeWarningIncident(incident: WarningIncidentRef | null): string {
  return incident ? `${incident.kind}:${incident.id}` : '';
}

/** 위 표기를 되돌린다. 모양이 아니면 null — 서버는 이 결과만 믿는다 */
export function decodeWarningIncident(value: string): WarningIncidentRef | null {
  const separator = value.indexOf(':');
  if (separator <= 0) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind !== 'queue' && kind !== 'usage') return null;
  if (!id) return null;

  return { kind, id };
}
