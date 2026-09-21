// 언어별 날짜 · 시간 서식 (F37 · 08 · 4번).
//
// **시간대는 언어와 무관하게 항상 KST 다.** 일본어를 골랐다고 기숙사 세탁실의
// 시각이 일본 시간이 되지는 않는다 — 바뀌는 것은 「2026년 9월 21일」이 「September 21,
// 2026」으로 읽히는 방식뿐이다. 그래서 timeZone 은 상수로 박고 locale 만 언어를 따른다.
//
// **여기서 "오늘 · 어제" 같은 판정을 하지 않는다.** 그 판정은 KST 자정 경계를 넘나드는
// 정책 판정이라 서버 시각으로 해야 한다(CLAUDE.md — 클라이언트 Date.now() 를 정책
// 판정 기준으로 쓰지 않는다). 서버가 판정해서 내려보내고, 이 파일은 서식만 맡는다.

import { INTL_LOCALE, type Lang } from './lang.ts';

export const SEOUL_TZ = 'Asia/Seoul';

/** 예) 2026년 9월 21일 · September 21, 2026 · 2026年9月21日 */
export function formatDate(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

/** 예) 2026년 9월 21일 14:30 — 24시간제로 통일한다(기존 화면과 같다) */
export function formatDateTime(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** 예) 9월 21일 · September 21 · 9月21日 */
export function formatMonthDay(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: SEOUL_TZ,
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

/** 예) 14:30 */
export function formatTime(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    timeZone: SEOUL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}
