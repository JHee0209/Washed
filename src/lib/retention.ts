// 보관 기간 규칙 — **얼마나 두는가**를 정하는 한 곳 (05 「보관 기간과 조회 기간」).
//
// 05 는 두 축을 갈라 적는다:
//   보관 … 서버가 그 데이터를 **언제 지우는가**  → 이 파일 + src/lib/cleanup.ts
//   조회 … 화면이 그중 **얼마를 보여주는가**      → 각 조회 함수의 SQL
// 「조회가 보관보다 짧을 수는 있어도 길 수는 없다」가 05 의 문장이다. 두 축이 같은
// 숫자를 봐야 그 문장을 지킬 수 있어서, 기간의 **숫자**만 여기 모으고 **거르는 일과
// 지우는 일은 계속 따로** 둔다.
//
// report-rules.ts 와 같은 성격의 순수 모듈이다 — DB 도 `server-only` 도 import 하지
// 않는다. 그래서 node --test 가 DB 없이 그대로 돌린다 (src/lib/retention.test.ts).
//
// **아래 import 가 `@/` 별칭이 아니라 상대 경로인 것은 일부러다.** 별칭은 번들러가
// 푸는 것이라, 테스트가 node 로 이 파일을 직접 불러오면 `@/lib/...` 를 찾지 못한다
// (report-rules.test.ts 머리말의 같은 이유). 확장자 `.ts` 도 그래서 적는다.

import { EVIDENCE_RETENTION_MONTHS, WITHDRAW_GRACE_DAYS } from './report-rules.ts';

// 이미 있는 숫자는 다시 적지 않는다 — report-rules.ts 가 원본이다.
export { EVIDENCE_RETENTION_MONTHS, WITHDRAW_GRACE_DAYS };

/** 05 P14 — 받은 지 30일이 지난 알림은 삭제한다 (배정 · 종료 · 경고 · 결과) */
export const NOTIFICATION_RETENTION_DAYS = 30;

/**
 * 05 P14 의 예외 — 「공지」 종류만 3개월이다.
 *
 * 공지 원본이 3개월 남으므로(P18) 30일로 자르면 아직 살아 있는 공지를 사생만
 * 못 보게 된다. 공지는 관리자가 쓴 공용 글이라 오래 두어도 개인정보가 늘지 않는다.
 */
export const NOTICE_NOTIFICATION_RETENTION_MONTHS = 3;

/** 05 P18 — 등록한 지 3개월이 지난 공지는 삭제한다 (06 「공지」의 보관 칸) */
export const NOTICE_RETENTION_MONTHS = 3;

/** 05 P17 · SP4 — 이용 내역은 3개월까지만 보관한다 */
export const USAGE_HISTORY_RETENTION_MONTHS = 3;

/**
 * 05 SP4 — 경고 **기록**(사유 · 시각)은 1개월만 보관한다.
 *
 * 2026-09-17 갱신: 이용 내역 · 신고와 함께 3개월이었던 것을, 경고만 1개월로 줄였다
 * (docs/05-policy.md 「확인할 수 없어 표시해 둔 것」 · SP4 갱신). 누적 횟수와 이용
 * 제한(usage_restrictions)은 여기 해당하지 않는다 — 05 의 대조표가 「지우지 않는다 —
 * 0회로 되돌린다」로 적어 둔 값이라 배치가 건드리지 않는다(P7).
 */
export const WARNING_RETENTION_MONTHS = 1;

/** 05 P23 · SP4 — 신고는 접수 시각부터 3개월 보관한다 */
export const REPORT_RETENTION_MONTHS = 3;

/**
 * 만료된 이메일 인증코드를 지우기까지 두는 여유 (08 · 1번 「아직 남은 것」 ④).
 *
 * **만료 시각만 보고 바로 지우면 안 된다.** 인증을 마친 줄은 expires_at 이 이미
 * 지난 뒤에도 10분 동안 일회용 표(ticket)를 받는다(verification.ts consumeTicket).
 * 그 창에 배치가 걸리면 가입이 통째로 깨진다. 10분보다 넉넉히 긴 하루를 둔다.
 *
 * 05 · 06 에 기간이 없는 값이라 정책이 아니라 **운영 여유**로 둔다.
 */
export const VERIFICATION_GRACE_DAYS = 1;

/** now 로부터 days 일 전. 그 시각보다 오래된 것이 삭제 대상이다. */
export function daysAgo(now: Date, days: number): Date {
  const at = new Date(now);
  at.setDate(at.getDate() - days);
  return at;
}

/**
 * now 로부터 months 개월 전. **Postgres `interval '3 months'` 와 같게 센다.**
 *
 * JS 의 setMonth 를 그냥 쓰면 월말에서 넘친다 — 5/31 에서 3개월을 빼면 2/31 이
 * 없어서 3/3 이 되어 버린다. Postgres 는 같은 계산을 2/28 로 **끌어당긴다**.
 * 조회는 SQL 의 interval 로, 삭제는 이 함수로 재는데 둘이 다른 날을 가리키면
 * 「조회가 보관보다 길 수 없다」(05)가 조용히 깨진다. 그래서 여기서도 끌어당긴다.
 */
export function monthsAgo(now: Date, months: number): Date {
  const at = new Date(now);
  const day = at.getDate();
  // 1일로 내려 두고 달을 옮기면 넘칠 자리가 없다.
  at.setDate(1);
  at.setMonth(at.getMonth() - months);
  // 옮긴 달에 그 날짜가 없으면 그 달의 마지막 날로 끌어당긴다 (Postgres 와 같다).
  const lastDayOfTargetMonth = new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate();
  at.setDate(Math.min(day, lastDayOfTargetMonth));
  return at;
}

/**
 * 05 P24 — 탈퇴 신청 후 되돌릴 수 있는 기간이 끝나는 시점.
 *
 * 이 시각보다 **먼저** 신청한 계정이 삭제 대상이다. 복구(cancelWithdrawal)도 같은
 * 값을 봐서, 배치를 기다리는 계정이 스스로 되살아나지 못하게 막는다.
 *
 * (evidence-storage.ts 에 있던 것을 옮겨 왔다 — 사진이 아니라 사용자에 관한 규칙이고,
 *  그 파일의 `server-only` 때문에 테스트에서 부를 수 없었다.)
 */
export function withdrawPurgeCutoff(now: Date = new Date()): Date {
  return daysAgo(now, WITHDRAW_GRACE_DAYS);
}

/** 05 P14 — 알림 종류에 따라 갈리는 두 컷오프. 배치가 한 문장 안에서 함께 쓴다. */
export function notificationCutoffs(now: Date = new Date()): { other: Date; notice: Date } {
  return {
    other: daysAgo(now, NOTIFICATION_RETENTION_DAYS),
    notice: monthsAgo(now, NOTICE_NOTIFICATION_RETENTION_MONTHS),
  };
}

/** 05 P18 — 공지 원본을 지우는 기준 시각 */
export function noticeCutoff(now: Date = new Date()): Date {
  return monthsAgo(now, NOTICE_RETENTION_MONTHS);
}

/** 05 P17 · SP4 — 이용 내역을 지우는 기준 시각 */
export function usageHistoryCutoff(now: Date = new Date()): Date {
  return monthsAgo(now, USAGE_HISTORY_RETENTION_MONTHS);
}

/** 05 SP4 — 경고 기록을 지우는 기준 시각 */
export function warningCutoff(now: Date = new Date()): Date {
  return monthsAgo(now, WARNING_RETENTION_MONTHS);
}

/** 05 P23 · SP4 — 신고를 지우는 기준 시각 */
export function reportCutoff(now: Date = new Date()): Date {
  return monthsAgo(now, REPORT_RETENTION_MONTHS);
}

/** 만료된 인증코드를 지우는 기준 시각 (VERIFICATION_GRACE_DAYS 의 이유를 함께 본다) */
export function verificationCutoff(now: Date = new Date()): Date {
  return daysAgo(now, VERIFICATION_GRACE_DAYS);
}

/**
 * 어떤 시각이 컷오프를 지났는가 — 배치가 지울 대상인지 판정한다.
 *
 * SQL 은 `<=` 로 비교하므로 여기서도 **경계를 포함한다**. 테스트가 SQL 과 같은
 * 판정을 보게 하려고 함수로 뽑아 둔다.
 */
export function isExpired(at: Date, cutoff: Date): boolean {
  return at.getTime() <= cutoff.getTime();
}
