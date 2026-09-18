// 한국 시각(KST) 날짜 판정 — DB 도 server-only 도 import 하지 않는다.
// node:test 가 직접 돌리거나(별칭 미해석) 클라이언트 코드가 써도 되게 하기 위해서다
// (src/lib/report-rules.ts 와 같은 이유).

/**
 * 05 P7 — "매달 1일" 은 한국 시각(KST) 기준이다. DB `now()`·서버 시각은 UTC 라
 * 그대로 날짜만 비교하면 하루 어긋난다(KST = UTC+9).
 */
export function isFirstOfMonthInKst(now: Date = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCDate() === 1;
}
