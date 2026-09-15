// 학교 이메일 판정 — 05 P11 · 08 · 1번
//
// 「아이디는 `ac.kr` 로 끝나는 학교 이메일이어야 한다」가 규칙이고, 범위를 `ac.kr`
// 까지 넓게 열어 둔 것은 팀 확정이다(PRD 6절). 학교 구글 계정은 `g.eulji.ac.kr`
// 이지만 나중에 다른 학교로 넓히려고 좁히지 않았다.
//
// 그래서 구글 로그인의 `hd` 값으로 한 도메인만 묶을 수 없고, 자격 판단은
// **서버가 이메일 끝을 보고** 한다. 화면의 정규식은 안내일 뿐 판정이 아니다.
//
// 을지대만 받을 시점이 오면 P11 을 좁히고 이 파일 한 곳만 고치면 된다.

const SCHOOL_EMAIL = /^[^@\s]+@[^@\s]+\.ac\.kr$/i;

/** 저장 · 비교에 쓰는 형태로 맞춘다. 이메일은 항상 소문자로 둔다. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** `ac.kr` 로 끝나는 학교 이메일인가 (05 P11) */
export function isSchoolEmail(email: string): boolean {
  return SCHOOL_EMAIL.test(email);
}

/** 정규화 + 판정을 한 번에. 아니면 null 이다. */
export function toSchoolEmail(raw: unknown): string | null {
  const email = normalizeEmail(raw);
  return isSchoolEmail(email) ? email : null;
}

/** 비밀번호 8자 이상 (05 P11 · P22) — 해시로 바꾸기 전에 본다 */
export function isValidPassword(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length >= 8;
}

/** 학번: 숫자만 · 12자리까지 · 필수 (05 P11) */
export function isValidStudentId(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[0-9]{1,12}$/.test(raw.trim());
}
