// DB 에 저장된 한국어 값 → 화면에 그릴 번역 key (13번 「동적 데이터와 고정 UI 구분」).
//
// **이 파일의 존재 이유는 "값과 라벨을 가르는 것" 이다.**
// db/schema.sql 의 CHECK 제약은 한국어 문자열을 받는다. 그 값을 번역해서
// state 나 요청에 담으면 INSERT 가 전부 CHECK 에 걸려 실패한다. 그래서
//   · state · 요청 · INSERT 에는 **DB 한국어 값 그대로**
//   · 화면에 그릴 때만 여기를 거쳐 t(key) 로
// 라는 규칙을 둔다. notifications-client.tsx 가 이미 쓰던 방식(value=결과 / label=신고)을
// 화면 전체로 넓힌 것이다.
//
// 각 맵은 `satisfies Record<…, MessageKey>` 라서, 스키마에 값이 하나 늘면
// 여기가 컴파일되지 않는다 — 라벨을 빠뜨린 채로 배포되지 않게 하는 장치다.

import { MACHINE_KINDS, REASON_LABELS, type MachineKind, type ReasonLabel } from '../report-rules.ts';
import type { MessageKey } from './types.ts';

// ── 기기 종류 — db/schema.sql machines.kind · reports.machine_kind
export const MACHINE_KIND_KEY = {
  세탁기: 'enum.machineKind.washer',
  건조기: 'enum.machineKind.dryer',
} as const satisfies Record<MachineKind, MessageKey>;

/**
 * 기기 상태 — db/schema.sql:125 `CHECK (status IN ('사용가능','사용중','고장','점검중'))`
 *
 * **저장값 `'점검중'` 에는 띄어쓰기가 없고 화면 문구 「점검 중」에는 있다.**
 * 값과 라벨이 실제로 다른 자리라, 화면 문자열로 DB 를 조회하면 아무것도 걸리지 않는다.
 */
export const MACHINE_STATUS_VALUES = ['사용가능', '사용중', '고장', '점검중'] as const;
export type MachineStatus = (typeof MACHINE_STATUS_VALUES)[number];

export const MACHINE_STATUS_KEY = {
  사용가능: 'enum.machineStatus.available',
  사용중: 'enum.machineStatus.inUse',
  고장: 'enum.machineStatus.fault',
  점검중: 'enum.machineStatus.inspection',
} as const satisfies Record<MachineStatus, MessageKey>;

/**
 * 알림 종류 — db/schema.sql:371 `CHECK (kind IN ('공지','배정','종료','경고','결과'))`
 *
 * 값 `'결과'` 는 화면에 「신고」로 나간다 — 기존 notifications-client.tsx 의 동작이고
 * 번역에서도 그대로 유지한다.
 */
export const NOTIFICATION_KINDS = ['공지', '배정', '종료', '경고', '결과'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_KEY = {
  공지: 'enum.notificationKind.notice',
  배정: 'enum.notificationKind.assigned',
  종료: 'enum.notificationKind.ended',
  경고: 'enum.notificationKind.warning',
  결과: 'enum.notificationKind.report',
} as const satisfies Record<NotificationKind, MessageKey>;

// ── 이용 내역 결과 — db/schema.sql:414 `CHECK (result IN ('완료','경고'))`
export const HISTORY_RESULTS = ['완료', '경고'] as const;
export type HistoryResult = (typeof HISTORY_RESULTS)[number];

export const HISTORY_RESULT_KEY = {
  완료: 'enum.historyResult.done',
  경고: 'enum.historyResult.warned',
} as const satisfies Record<HistoryResult, MessageKey>;

/**
 * 경고 사유 — db/schema.sql:215 `CHECK (reason IN ('배정 후 미인증','수거 미완료',
 * '신고 확인','순서 미준수','세탁물 방치'))`
 */
export const WARNING_REASONS = [
  '배정 후 미인증',
  '수거 미완료',
  '신고 확인',
  '순서 미준수',
  '세탁물 방치',
] as const;
export type WarningReason = (typeof WARNING_REASONS)[number];

export const WARNING_REASON_KEY = {
  '배정 후 미인증': 'enum.warningReason.noVerify',
  '수거 미완료': 'enum.warningReason.notCollected',
  '신고 확인': 'enum.warningReason.reportConfirmed',
  '순서 미준수': 'enum.warningReason.outOfOrder',
  '세탁물 방치': 'enum.warningReason.laundryLeft',
} as const satisfies Record<WarningReason, MessageKey>;

/** 신고 사유 — 화면 라벨 쪽이다(report-rules.ts REASON_LABELS). DB 저장값은 그쪽이 변환한다 */
export const REPORT_REASON_LABEL_KEY = {
  '기기가 고장났어요': 'enum.reportReason.broken',
  '순서를 지키지 않았어요': 'enum.reportReason.outOfOrder',
  '세탁물이 있어요': 'enum.reportReason.laundryLeft',
  기타: 'enum.reportReason.etc',
} as const satisfies Record<ReasonLabel, MessageKey>;

/**
 * 모르는 값이 와도 화면이 깨지지 않게 하는 조회 함수들.
 *
 * DB 에는 지금 CHECK 에 없는 옛 값이 남아 있을 수 있고(스키마는 시간이 지나며 바뀐다),
 * 그럴 때는 **저장된 한국어를 그대로 보여준다** — 번역되지 않을 뿐 정보는 잃지 않는다.
 */
// 반환 타입을 `MessageKey` 로 넓히지 않고 **그 맵이 실제로 가리키는 key 들**로 좁혀
// 둔다. 넓히면 t(돌려받은 key) 가 「치환 인자를 받는 key 일 수도 있다」는 이유로
// 인자를 요구해 버린다(types.ts 의 TParams). 여기 맵들의 key 는 전부 인자가 없다.
function keyOf<M extends Record<string, MessageKey>>(map: M, value: string): M[keyof M] | null {
  return Object.hasOwn(map, value) ? map[value as keyof M] : null;
}

export const machineKindKey = (v: string) => keyOf(MACHINE_KIND_KEY, v);
export const machineStatusKey = (v: string) => keyOf(MACHINE_STATUS_KEY, v);
export const notificationKindKey = (v: string) => keyOf(NOTIFICATION_KIND_KEY, v);
export const historyResultKey = (v: string) => keyOf(HISTORY_RESULT_KEY, v);
export const warningReasonKey = (v: string) => keyOf(WARNING_REASON_KEY, v);
export const reportReasonLabelKey = (v: string) => keyOf(REPORT_REASON_LABEL_KEY, v);

/** report-rules.ts 의 목록과 이 파일의 맵이 어긋나지 않는지 테스트가 쓰는 값 */
export const _MACHINE_KINDS_SOURCE = MACHINE_KINDS;
export const _REASON_LABELS_SOURCE = REASON_LABELS;
