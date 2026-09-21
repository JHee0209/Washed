// 번역 한 건을 실제로 만들어 내는 순수 함수들 (F37 · 6번 「fallback」).
//
// React 를 import 하지 않는다 — node --test 가 번들러 없이 그대로 부른다.

import { DICTS } from './dictionaries.ts';
import { ko } from './ko.ts';
import type { Lang } from './lang.ts';
import type { MessageKey, MessageParams, TParams } from './types.ts';

/**
 * 사전에서 문장을 꺼낸다. **Issue 6번의 fallback 사슬이 여기 전부 있다.**
 *
 *   고른 언어 → 없으면 한국어 → 그것도 없으면 key 그대로
 *
 * 타입(`satisfies Dictionary`)이 이미 누락을 막고 있으므로 여기까지 오는 경우는
 * 캐스팅했거나 key 를 문자열로 만들어 넘긴 때다. 그래도 **화면이 깨지거나
 * undefined 가 보이지 않게** 마지막 단계를 둔다.
 *
 * key 를 `string` 으로 받는 이유도 같다 — MessageKey 로 좁히면 이 안전망이
 * 필요한 바로 그 호출(동적 key)에서 쓸 수 없다.
 */
export function lookup(lang: Lang, key: string): string {
  const dict = DICTS[lang] as Record<string, string | undefined> | undefined;
  const hit = dict?.[key];
  if (hit !== undefined) return hit;

  const korean = (ko as Record<string, string | undefined>)[key];
  if (korean !== undefined) return korean;

  // 여기까지 오면 사전에 아예 없는 key 다. 빈 화면보다 key 가 보이는 편이 낫다 —
  // 사용자에게도 무언가 빠졌다는 신호가 되고, 개발 중에는 바로 눈에 띈다.
  return key;
}

/**
 * `{name}` 자리를 값으로 바꾼다.
 *
 * 넘기지 않은 이름은 **그대로 둔다** — 지우면 문장이 조용히 이상해지고,
 * 던지면 화면이 통째로 죽는다. 남아 있는 `{name}` 은 개발 중에 눈에 띄는 쪽이다.
 */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}

/** lookup + interpolate. useT() 가 감싸 쓰는 실제 알맹이다 */
export function translate<K extends MessageKey>(
  lang: Lang,
  key: K,
  ...args: TParams<K>
): string {
  return interpolate(lookup(lang, key), args[0] as MessageParams | undefined);
}

/** splitSlots() 의 조각 — 문자열이거나, 끼워 넣을 자리 이름이거나 */
export type RichPart = string | { slot: string };

/**
 * 문장 안에 **ReactNode 를 끼워 넣기** 위해 `{name}` 기준으로 쪼갠다.
 *
 * 문장 가운데가 굵어지는 자리(`<b>공유</b> 를 누르고…`)를 조각 key 로 나누지
 * 않으려고 둔다 — 언어마다 어순이 달라서 조각으로 나누면 번역이 불가능해진다.
 * 실제로 끼우는 것은 rich.tsx 의 <Rich> 이고, 이 함수는 JSX 가 없어 테스트된다.
 */
export function splitSlots(text: string): RichPart[] {
  const parts: RichPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const at = match.index;
    if (at > lastIndex) parts.push(text.slice(lastIndex, at));
    parts.push({ slot: match[1] });
    lastIndex = at + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}
