// API 오류 code → 번역 key (F37 · Issue #13 의 16단계).
//
// ── 왜 code 인가
// 서버가 만드는 오류 문장은 한국어다. 그 문장을 그대로 번역하려면 다시 「한국어를
// key 로 쓰기」가 되고, 그것이 이 Issue 가 없애려는 방식이다(08 · 11번). 그래서
// 서버는 **언어와 무관한 안정적인 식별자**를 함께 돌려주고, 번역은 화면이 한다.
//
// ── 기존 계약을 깨지 않는다
// 서버의 `message` 는 **지우지도 번역하지도 않는다.** code 를 옆에 더하기만 한다.
//   · 기존 API 소비자와 테스트의 message 단정이 그대로 통과한다
//   · 관리자 화면은 계속 한국어 message 를 쓴다 (관리자 UI 는 한국어 고정)
//
// ── 우선순위 (tApiError)
//   code 를 알고 key 가 있으면 → 그 번역
//   code 를 알지만 key 가 null 이면 → **화면이 가진 행동별 문구** (그쪽이 더 구체적이다)
//   code 가 없거나 모르는 값이면 → 서버 message → 화면 문구
//
// ── key 가 null 인 code
// 「…에 실패했어요. 잠시 뒤 다시 시도해주세요」류다. 화면에는 이미
// `home.joinFailed` 처럼 **무엇에 실패했는지가 담긴** 번역이 있어서 그쪽이 낫다.
// code 를 「알고 있다」고 표시해 두는 이유는, 그래야 한국어 message 로 새지 않고
// 화면 문구로 내려가기 때문이다.

import type { MessageKey } from './types.ts';

/**
 * 오류 code → 화면에 그릴 번역 key.
 *
 * **의미가 같은 오류는 같은 code 를 쓴다.** 92곳의 응답 지점을 59개로 묶었다 —
 * 예: 「잘못된 요청이에요」 13곳이 모두 BAD_REQUEST 하나다.
 */
export const API_ERROR_KEY = {
  // ── 공통
  BAD_REQUEST: 'error.badRequest',
  LOGIN_REQUIRED: 'common.loginRequired',
  ACCOUNT_WITHDRAW_PENDING: 'error.accountWithdrawPending',

  // ── 이메일 · 인증 · 가입
  EMAIL_INVALID: 'signup.emailInvalid',
  EMAIL_ALREADY_REGISTERED: 'error.emailAlreadyRegistered',
  EMAIL_VERIFY_REQUIRED: 'signup.emailVerifyRequired',
  EMAIL_VERIFY_AGAIN: 'error.emailVerifyAgain',
  VERIFY_AGAIN: 'error.verifyAgain',
  STUDENT_ID_REQUIRED: 'signup.studentIdRequired',
  STUDENT_ID_ALREADY_REGISTERED: 'error.studentIdAlreadyRegistered',
  FIELDS_REQUIRED: 'error.fieldsRequired',
  TERMS_AGREEMENT_REQUIRED: 'error.termsAgreementRequired',
  CODE_SEND_FAILED: null,
  SIGNUP_FAILED: null,

  // ── 비밀번호
  PASSWORD_TOO_SHORT: 'signup.pwTooShort',
  PASSWORD_CURRENT_REQUIRED: 'error.passwordCurrentRequired',
  PASSWORD_CURRENT_WRONG: 'profile.currentPwWrong',
  PASSWORD_SAME_AS_CURRENT: 'error.passwordSameAsCurrent',
  PASSWORD_ALREADY_CHANGED: 'error.passwordAlreadyChanged',
  PASSWORD_GOOGLE_ACCOUNT: 'error.passwordGoogleAccount',

  // ── 줄서기 (05 P1~P3)
  MACHINE_KIND_UNKNOWN: 'error.machineKindUnknown',
  FACILITY_UNDER_INSPECTION: 'error.facilityUnderInspection',
  NO_MACHINE_AVAILABLE: 'error.noMachineAvailable',
  QUEUE_ALREADY_JOINED: 'error.queueAlreadyJoined',
  QUEUE_ASSIGNED_TO_OTHER: 'error.queueAssignedToOther',
  QUEUE_NOT_FOUND: 'error.queueNotFound',
  QUEUE_LEAVE_BLOCKED_ASSIGNED: 'error.queueLeaveBlockedAssigned',
  QUEUE_LEAVE_BLOCKED_JUST_ASSIGNED: 'error.queueLeaveBlockedJustAssigned',
  QUEUE_JOIN_FAILED: null,
  QUEUE_LEAVE_FAILED: null,

  // ── 이용 · 종료 (05 P4 · P5)
  MACHINE_INFO_INVALID: 'error.machineInfoInvalid',
  USAGE_NOT_ACTIVE: 'error.usageNotActive',
  USAGE_OTHER_USER: 'error.usageOtherUser',
  USAGE_QR_NOT_VERIFIED: 'error.usageQrNotVerified',
  FINISH_FAILED: null,

  // ── QR 인증 (F8 · 05 P3 · P4)
  QR_SERVER_MISCONFIGURED: 'error.qrServerMisconfigured',
  QR_UNKNOWN: 'error.qrUnknown',
  QR_MACHINE_NOT_REGISTERED: 'error.qrMachineNotRegistered',
  QR_NOT_ASSIGNED_MACHINE: 'error.qrNotAssignedMachine',
  QR_ASSIGNED_TO_OTHER: 'error.qrAssignedToOther',
  QR_PICKUP_PENDING: 'error.qrPickupPending',
  QR_EXPIRED: 'error.qrExpired',
  QR_VERIFY_FAILED: null,

  // ── 신고 (F11 · 05 P15)
  REPORT_REASON_REQUIRED: 'error.reportReasonRequired',
  REPORT_MACHINE_KIND_REQUIRED: 'error.reportMachineKindRequired',
  REPORT_MACHINE_NO_REQUIRED: 'error.reportMachineNoRequired',
  REPORT_ETC_NO_MACHINE: 'error.reportEtcNoMachine',
  REPORT_ETC_CONTENT_REQUIRED: 'error.reportEtcContentRequired',
  REPORT_ETC_TOO_LONG: 'error.reportEtcTooLong',
  REPORT_EVIDENCE_REQUIRED: 'error.reportEvidenceRequired',
  REPORT_EVIDENCE_NOT_ALLOWED: 'error.reportEvidenceNotAllowed',
  REPORT_FAILED: null,

  // ── 사진 (신고 증거 · 프로필 공용)
  IMAGE_TYPE_NOT_ALLOWED: 'common.imageTypeOnly',
  IMAGE_EMPTY: 'error.imageEmpty',
  IMAGE_TOO_LARGE: 'error.imageTooLarge',
  PHOTO_REQUIRED: 'error.photoRequired',
  PHOTO_NOT_FOUND: 'error.photoNotFound',

  // ── 문의 (F21)
  INQUIRY_CONTENT_REQUIRED: 'error.inquiryContentRequired',
  INQUIRY_TOO_LONG: 'error.inquiryTooLong',
  INQUIRY_FAILED: null,
} as const satisfies Record<string, MessageKey | null>;

export type ApiErrorCode = keyof typeof API_ERROR_KEY;

/**
 * 서버가 오류와 함께 돌려보내는 모양.
 *
 * `message` 는 기존 그대로 남는다 — code 를 모르는 소비자(관리자 화면 · 기존
 * 테스트 · 옛 클라이언트)가 계속 쓴다.
 */
export type ApiErrorBody = {
  ok: false;
  /** 언어와 무관한 식별자 */
  code?: ApiErrorCode;
  /** 문장에 끼울 값. 번역문의 `{name}` 자리와 이름이 같아야 한다 */
  params?: Record<string, string | number>;
  /** 한국어 원문. **지우지 않는다** (기존 계약) */
  message?: string;
};

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.hasOwn(API_ERROR_KEY, value);
}
