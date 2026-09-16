// 신고 접수의 규칙 한 곳 (F11 · 05 P15 · P23 · 08 · 7번).
//
// **화면과 서버가 같은 조건을 보게 하는 것이 이 파일의 존재 이유다.**
// 08 · 7번: 「화면은 showEvidenceSlot · canSubmit 으로 막고 있지만 **서버에서도
// 같은 조건을 확인해야 한다**」 — 두 곳에 조건을 따로 적으면 반드시 어긋나므로
// 판정을 validateReportInput() 하나에 두고 양쪽이 그것을 부른다.
//
// 그래서 이 파일은 DB 도 `server-only` 도 import 하지 않는다 —
// 클라이언트 컴포넌트(src/app/settings/page.tsx)에서도 그대로 쓴다.

/**
 * 화면 라벨 → DB 사유.
 *
 * **둘이 다르다.** 화면은 말투가 있는 문장이고(`설정.dc.html` 에서 온 것),
 * db/schema.sql 의 `reports.reason` CHECK 는 06 「신고」의 짧은 이름만 받는다.
 * 화면 문자열을 그대로 INSERT 하면 CHECK 에 걸려 전부 실패한다.
 */
export const REASON_LABEL_TO_DB = {
  '기기가 고장났어요': '기기 고장',
  '순서를 지키지 않았어요': '순서 미준수',
  '세탁물이 있어요': '세탁물 있음',
  기타: '기타',
} as const satisfies Record<string, string>;

/** 화면에 뜨는 순서대로 (05 P15) */
export const REASON_LABELS = [
  '기기가 고장났어요',
  '순서를 지키지 않았어요',
  '세탁물이 있어요',
  '기타',
] as const;

export type ReasonLabel = (typeof REASON_LABELS)[number];

/** db/schema.sql `reports.reason` CHECK 와 같은 집합이어야 한다 */
export const DB_REASONS = ['기기 고장', '순서 미준수', '세탁물 있음', '기타'] as const;
export type DbReason = (typeof DB_REASONS)[number];

/**
 * 05 P15 — 증거 사진이 붙는 **유일한** 사유. 여기서만 필수고,
 * 나머지 세 사유에는 칸 자체가 없다(= 반드시 비어 있다).
 */
export const REASON_LAUNDRY_LEFT: DbReason = '세탁물 있음';

/**
 * 05 P15 — 기기 관련 세 사유는 기기 종류와 호기를 함께 골라야 한다.
 * 「기타」는 기기를 고르지 않는다.
 */
export const REASONS_NEEDING_MACHINE: readonly DbReason[] = [
  '기기 고장',
  '순서 미준수',
  '세탁물 있음',
];

/** db/schema.sql `reports.machine_kind` CHECK 와 같은 집합 */
export const MACHINE_KINDS = ['세탁기', '건조기'] as const;
export type MachineKind = (typeof MACHINE_KINDS)[number];

/**
 * 종류별 기기 대수 (08 · 8번 — 화면에 박혀 있는 값이다).
 * 기기 목록이 DB 조회로 바뀌면 이 상수는 사라지고 machines 를 세면 된다.
 */
export const MACHINE_COUNT: Record<MachineKind, number> = { 세탁기: 8, 건조기: 4 };

/**
 * 증거 사진 용량 한도.
 *
 * **PRD 에도 05 에도 값이 없어 여기서 새로 정한다.** 08 · 7번이 "용량 제한이
 * 필요하다" 라고만 적어 두었다. 4MB 로 잡은 근거:
 *   · 폰 카메라 사진 한 장이 보통 2~4MB 다 — 세탁물을 찍어 올리는 데 충분하다
 *   · 저장은 Neon Postgres 안이고 base64 로 실어 보내므로 1.34배로 부푼다.
 *     4MB → 약 5.4MB 로 SQL 한 문장에 담긴다
 * 바꿀 때는 이 한 줄만 고치면 화면과 서버가 함께 따라온다.
 */
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

/** 사람이 읽는 한도 표기 — 화면 문구와 서버 오류 메시지가 함께 쓴다 */
export const MAX_EVIDENCE_LABEL = `${MAX_EVIDENCE_BYTES / (1024 * 1024)}MB`;

/**
 * 받아 주는 이미지 형식. **서버가 이 목록으로 거부한다** — accept 속성은 힌트일 뿐이다.
 * db/migrations/0005 의 `report_evidence.mime_type` CHECK 도 같은 집합이다.
 */
export const ALLOWED_EVIDENCE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type EvidenceMime = (typeof ALLOWED_EVIDENCE_MIME)[number];

/** 05 P23 — 증거 사진은 올린 시점부터 3개월 보관한 뒤 삭제한다 */
export const EVIDENCE_RETENTION_MONTHS = 3;

/** 05 P24 — 탈퇴 신청 후 되돌릴 수 있는 기간. 지나면 배치가 지운다 */
export const WITHDRAW_GRACE_DAYS = 14;

/** 06 「기타 내용」 — 06 · 05 에 길이 한도가 없어 서버가 거절할 상한만 둔다 */
export const MAX_ETC_LENGTH = 1000;

export function isReasonLabel(value: unknown): value is ReasonLabel {
  return typeof value === 'string' && (REASON_LABELS as readonly string[]).includes(value);
}

export function isMachineKind(value: unknown): value is MachineKind {
  return typeof value === 'string' && (MACHINE_KINDS as readonly string[]).includes(value);
}

export function isAllowedEvidenceMime(value: unknown): value is EvidenceMime {
  return typeof value === 'string' && (ALLOWED_EVIDENCE_MIME as readonly string[]).includes(value);
}

/** 05 P15 — 이 사유에 사진이 반드시 있어야 하는가 */
export function requiresEvidence(reason: DbReason): boolean {
  return reason === REASON_LAUNDRY_LEFT;
}

/** 05 P15 — 이 사유에 기기 종류·호기가 반드시 있어야 하는가 */
export function requiresMachine(reason: DbReason): boolean {
  return REASONS_NEEDING_MACHINE.includes(reason);
}

/** 화면이 들고 있는 값 그대로 — 아직 아무것도 검증되지 않은 상태다 */
export type ReportInput = {
  reasonLabel: unknown;
  machineKind: unknown;
  /** 화면은 숫자, FormData 는 문자열로 준다 — 둘 다 받는다 */
  machineNo: unknown;
  etcContent: unknown;
  /** 첨부된 사진. 없으면 null */
  evidence: { mime: unknown; byteSize: number } | null;
};

/** 검증을 통과한 값 — 이 모양이면 그대로 INSERT 해도 CHECK 에 걸리지 않는다 */
export type ValidReport = {
  reason: DbReason;
  machineKind: MachineKind | null;
  machineNo: number | null;
  etcContent: string | null;
  evidence: { mime: EvidenceMime; byteSize: number } | null;
};

export type ValidationResult =
  | { ok: true; value: ValidReport }
  /** `status` 는 라우트가 그대로 HTTP 상태로 쓴다 (415 · 413 을 400 과 가른다) */
  | { ok: false; status: 400 | 413 | 415; message: string };

/**
 * 신고 한 건이 접수될 수 있는지 판정한다 (05 P15 · 08 · 7번).
 *
 * **화면과 서버가 모두 이 함수를 부른다.** 화면이 먼저 걸러 주는 것은 친절이고,
 * 접수를 정하는 것은 서버가 부른 이 함수다 — API 를 직접 찔러 화면 검증을
 * 건너뛰어도 같은 조건에 막힌다.
 */
export function validateReportInput(input: ReportInput): ValidationResult {
  // ── 사유 (05 P15 「사유를 고르지 않으면 접수할 수 없다」)
  if (!isReasonLabel(input.reasonLabel)) {
    return { ok: false, status: 400, message: '신고 사유를 선택해주세요.' };
  }
  const reason: DbReason = REASON_LABEL_TO_DB[input.reasonLabel];

  // ── 기기 종류 · 호기 (05 P15)
  let machineKind: MachineKind | null = null;
  let machineNo: number | null = null;

  if (requiresMachine(reason)) {
    if (!isMachineKind(input.machineKind)) {
      return { ok: false, status: 400, message: '기기 종류를 선택해주세요.' };
    }
    machineKind = input.machineKind;

    const parsed = Number(input.machineNo);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MACHINE_COUNT[machineKind]) {
      return { ok: false, status: 400, message: '호기를 선택해주세요.' };
    }
    machineNo = parsed;
  } else if (input.machineKind != null || (input.machineNo != null && input.machineNo !== '')) {
    // 「기타」에 기기가 딸려 오면 CHECK 제약에 걸린다. 여기서 먼저 막아
    // DB 오류가 아니라 읽히는 메시지가 나가게 한다.
    return { ok: false, status: 400, message: '「기타」는 기기를 선택하지 않습니다.' };
  }

  // ── 기타 내용 (06 「기타 내용」)
  let etcContent: string | null = null;
  if (typeof input.etcContent === 'string' && input.etcContent.trim()) {
    etcContent = input.etcContent.trim();
    if (etcContent.length > MAX_ETC_LENGTH) {
      return { ok: false, status: 400, message: `내용은 ${MAX_ETC_LENGTH}자까지 입력할 수 있어요.` };
    }
  }
  if (reason === '기타' && !etcContent) {
    // 05 P15 — 「"기타" 는 사진 · 기기 선택 없이 내용만 적는다」
    return { ok: false, status: 400, message: '어떤 문제인지 내용을 적어주세요.' };
  }

  // ── 증거 사진 (05 P15 · P23) — 이 작업의 핵심 조건
  const evidence = input.evidence;

  if (requiresEvidence(reason)) {
    // 「남의 세탁물을 꺼내는 근거가 되므로 사진 없이는 접수할 수 없다」(P15)
    if (!evidence) {
      return { ok: false, status: 400, message: '「세탁물이 있어요」는 증거 사진을 첨부해야 접수할 수 있어요.' };
    }
  } else if (evidence) {
    // 나머지 세 사유에는 칸 자체가 없다(P15). reports 의 CHECK 도 같은 것을 막는다.
    return { ok: false, status: 400, message: '이 사유에는 사진을 첨부할 수 없어요.' };
  }

  if (evidence) {
    // 형식 — accept 속성을 믿지 않는다. 확장자가 아니라 MIME 으로 본다.
    if (!isAllowedEvidenceMime(evidence.mime)) {
      return { ok: false, status: 415, message: 'JPG · PNG · WebP 이미지만 첨부할 수 있어요.' };
    }
    if (evidence.byteSize <= 0) {
      return { ok: false, status: 400, message: '사진 파일이 비어 있어요.' };
    }
    // 용량 — 라우트는 여기에 **실제로 읽은 바이트 수**를 넣는다(헤더가 아니라).
    if (evidence.byteSize > MAX_EVIDENCE_BYTES) {
      return { ok: false, status: 413, message: `사진은 ${MAX_EVIDENCE_LABEL} 까지 첨부할 수 있어요.` };
    }
  }

  return {
    ok: true,
    value: {
      reason,
      machineKind,
      machineNo,
      etcContent,
      evidence: evidence ? { mime: evidence.mime as EvidenceMime, byteSize: evidence.byteSize } : null,
    },
  };
}
