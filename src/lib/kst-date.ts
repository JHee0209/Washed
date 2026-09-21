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

/** 'en-CA' 는 'YYYY-MM-DD' 로 찍는다 — `<input type="date">` 의 값과 같은 형식이다 */
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * 한국 시각 기준 날짜 열쇠 'YYYY-MM-DD' (Issue #86 — 관리자 이용 내역 날짜 필터).
 *
 * DB 의 timestamptz 는 UTC 로 내려온다. 그대로 날짜만 잘라 비교하면 KST 00:00~08:59 에
 * 시작한 이용이 **전날** 것으로 걸린다(KST = UTC+9). 필터의 기준은 「이용 시작 시각의
 * 한국 날짜」이므로 여기서 서울 시간대로 옮겨 찍는다.
 */
export function seoulDayKey(value: string | Date): string {
  return dayKeyFmt.format(typeof value === 'string' ? new Date(value) : value);
}
