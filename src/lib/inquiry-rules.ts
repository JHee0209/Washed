// 문의 접수의 규칙 한 곳 (F21 · 05 SP8 · Issue #86).
//
// src/lib/report-rules.ts 와 **같은 이유로 존재한다** — 화면과 서버가 같은 조건을
// 보게 하려는 것이다. 조건을 두 곳에 따로 적으면 반드시 어긋나므로 판정을
// validateInquiryInput() 하나에 두고 화면과 라우트가 그것을 부른다.
//
// 그래서 이 파일은 DB 도 `server-only` 도 import 하지 않는다 —
// 클라이언트 컴포넌트(src/app/(user)/support/support-client.tsx)에서도 그대로 쓴다.

/**
 * 문의 내용 길이 한도.
 *
 * **06 · 05 에 값이 없어 서버가 정한다** — reports 의 「기타 내용」(MAX_ETC_LENGTH)과
 * 같은 이유·같은 값이다. db/schema.sql 의 `inquiries.content` CHECK 와 **반드시 같아야**
 * 한다 — 여기만 늘리면 DB 가 거부하고, DB 만 늘리면 화면이 먼저 막는다.
 */
export const MAX_INQUIRY_LENGTH = 1000;

/** 화면이 들고 있는 값 그대로 — 아직 아무것도 검증되지 않은 상태다 */
export type InquiryInput = { content: unknown };

/** 검증을 통과한 값 — 이 모양이면 그대로 INSERT 해도 CHECK 에 걸리지 않는다 */
export type ValidInquiry = { content: string };

export type InquiryValidation =
  | { ok: true; value: ValidInquiry }
  /** `status` 는 라우트가 그대로 HTTP 상태로 쓴다 */
  | { ok: false; status: 400; message: string };

/**
 * 문의 한 건이 접수될 수 있는지 판정한다 (04 F21 「미입력 시 전송 불가」).
 *
 * **화면과 서버가 모두 이 함수를 부른다.** 화면이 먼저 버튼을 잠그는 것은 친절이고,
 * 접수를 정하는 것은 서버가 부른 이 함수다 — API 를 직접 찔러도 같은 조건에 막힌다.
 *
 * 통과하면 **trim 된 값**을 돌려준다. 라우트는 원본이 아니라 이 값을 넣는다.
 */
export function validateInquiryInput(input: InquiryInput): InquiryValidation {
  if (typeof input.content !== 'string') {
    return { ok: false, status: 400, message: '문의 내용을 적어주세요.' };
  }

  const content = input.content.trim();
  if (!content) {
    return { ok: false, status: 400, message: '문의 내용을 적어주세요.' };
  }

  if (content.length > MAX_INQUIRY_LENGTH) {
    return {
      ok: false,
      status: 400,
      message: `문의 내용은 ${MAX_INQUIRY_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  return { ok: true, value: { content } };
}
