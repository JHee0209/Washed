'use client';

// 화면이 쓰는 두 가지 — `useLang()` 과 `useT()`.
//
// 여기에는 로직을 두지 않는다. 판정은 translate.ts(순수 · 테스트됨)에 있고
// 이 파일은 그것을 React 에 연결하는 배관이다.

import { useMemo, useSyncExternalStore } from 'react';

import type { Lang } from './lang.ts';
import { langServerSnapshot, langSnapshot, subscribeLang } from './store.ts';
import { translate } from './translate.ts';
import type { MessageKey, TFunction, TParams } from './types.ts';

/** 지금 고른 언어. 날짜 서식처럼 문장이 아닌 것을 맞출 때 쓴다 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, langSnapshot, langServerSnapshot);
}

/**
 * 번역 함수를 돌려준다.
 *
 *   const t = useT();
 *   <button>{t('common.confirm')}</button>
 *   <span>{t('home.usingMachine', { machine: m.name })}</span>
 *
 * 없는 key 는 컴파일되지 않고, 치환 인자도 타입이 강제한다(types.ts).
 */
export function useT(): TFunction {
  const lang = useLang();
  return useMemo<TFunction>(
    () =>
      <K extends MessageKey>(key: K, ...args: TParams<K>) =>
        translate(lang, key, ...args),
    [lang],
  );
}
