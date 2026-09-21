// 어떤 언어를 쓰는지 하나로 정하는 자리 (F37 · 05 P25 · 06 「언어 설정」 · 08 · 11번).
//
// **언어는 계정이 아니라 기기에 붙는다.** 그래서 users 표에 칸을 만들지 않고
// localStorage 의 `washed_lang` 하나만 본다 (06 마지막 문단 · 08 · 2번).
// 로그아웃해도, 다른 사람이 같은 폰으로 로그인해도 그 기기의 선택이 남는 이유다.
//
// 이 파일은 DB 도 `server-only` 도 React 도 import 하지 않는다 — report-rules.ts 와
// 같은 이유다. 서버 · 클라이언트 · node --test 가 모두 그대로 부른다.

/** 화면에 뜨는 순서대로 (05 P25) */
export const LANGS = ['ko', 'en', 'zh', 'ja'] as const;

export type Lang = (typeof LANGS)[number];

/** 05 P25 「기본값은 한국어다」 — 사전에 없는 문장이 기대는 자리이기도 하다 */
export const DEFAULT_LANG: Lang = 'ko';

/** 08 · 2번 「localStorage 키 → 테이블」 표에 적힌 이름 그대로 */
export const LANG_STORAGE_KEY = 'washed_lang';

/**
 * 언어 이름은 **그 언어로** 적는다.
 * 일본어를 고르려는 사람이 한국어 「일본어」를 읽을 수 있다고 볼 수 없다.
 */
export const LANG_LABELS: Record<Lang, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/**
 * 아무 값이나 받아 쓸 수 있는 언어로 만든다. 모르는 값은 전부 한국어다.
 *
 * 대소문자를 맞춰 주거나 `ko-KR` 에서 `ko` 를 떼어 내지 **않는다** — 우리가 쓰는
 * 값은 언어 선택 UI 가 넣은 네 가지뿐이라, 그 밖의 값은 사람이 손으로 고쳤거나
 * 다른 프로그램이 덮어쓴 것이다. 관대하게 받아 주면 그 사고가 조용히 묻힌다.
 */
export function parseLang(value: unknown): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

/**
 * 저장소에서 언어를 읽는다.
 *
 * `Storage` 전체가 아니라 `getItem` 만 받는다 — 브라우저 없이 node --test 에서
 * 그대로 부를 수 있게 하려는 것이다.
 *
 * **읽기 자체가 던질 수 있다.** 사파리 프라이빗 · 사이트 데이터 차단에서는
 * localStorage 에 손대는 순간 예외가 난다. 언어를 못 읽는 것 때문에 화면이
 * 하얗게 되면 안 되므로 한국어로 물러선다.
 */
export function readLangFrom(storage: Pick<Storage, 'getItem'> | null | undefined): Lang {
  if (!storage) return DEFAULT_LANG;
  try {
    return parseLang(storage.getItem(LANG_STORAGE_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * 날짜 · 시간 서식에 쓸 Intl 로케일.
 *
 * **시간대는 여기서 정하지 않는다** — 화면이 `timeZone: 'Asia/Seoul'` 을 따로 넘긴다.
 * 언어를 바꿨다고 기숙사 세탁실의 시각이 바뀌지는 않기 때문이다 (08 · 4번).
 */
export const INTL_LOCALE: Record<Lang, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
};
