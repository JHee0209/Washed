// 번역 key 와 치환 인자의 타입 (F37 · 15번 「타입 안정성」).
//
// 목표는 하나다 — **없는 key 와 잘못된 치환 인자를 `npx tsc --noEmit` 에서 잡는다.**
// 그래서 사전을 JSON 이 아니라 `.ts` 로 둔다. JSON 은 `satisfies` 를 달 수 없어
// 이 파일의 보장이 전부 사라진다.

import type { ko } from './ko.ts';

/** ko.ts 에 있는 key 만 쓸 수 있다 */
export type MessageKey = keyof typeof ko;

/**
 * 한 언어의 사전 모양.
 *
 * `en.ts` 등이 `satisfies Dictionary` 를 달면 **양방향**으로 막힌다 —
 * key 가 빠지면 Record 를 만족하지 못해서, 없는 key 를 더하면 객체 리터럴의
 * 초과 속성 검사에서. 이것이 「네 언어 key 누락 검증」의 본체다.
 */
export type Dictionary = Record<MessageKey, string>;

/** 그 key 의 한국어 원문 리터럴 — 치환 인자 이름을 여기서 뽑아낸다 */
type KoMessage<K extends MessageKey> = (typeof ko)[K];

/** '{a} 와 {b}' → 'a' | 'b' · 치환 자리가 없으면 never */
type ParamNames<S extends string> = S extends `${string}{${infer P}}${infer R}`
  ? P | ParamNames<R>
  : never;

/**
 * t() 의 두 번째 인자.
 *
 * 한국어 원문에 `{…}` 가 없으면 **인자를 받지 않는다**(빈 튜플). 있으면 그 이름들을
 * 전부 채워야 한다. 그래서 다음이 전부 컴파일 오류다.
 *   t('home.usingMachine')                     인자 누락
 *   t('home.usingMachine', { machineName: x }) 이름 오타
 *   t('common.confirm', { x: 1 })              필요 없는 인자
 *
 * 재귀 깊이는 치환 자리 수와 같다 — 이 앱에서 가장 많은 문장도 세 개라 비용이 없다.
 */
export type TParams<K extends MessageKey> = [ParamNames<KoMessage<K>>] extends [never]
  ? []
  : [params: Record<ParamNames<KoMessage<K>>, string | number>];

/** 치환 인자를 동적으로 넘기는 자리(런타임 함수 내부)에서 쓰는 느슨한 모양 */
export type MessageParams = Record<string, string | number>;

/** useT() 가 돌려주는 함수 */
export type TFunction = <K extends MessageKey>(key: K, ...args: TParams<K>) => string;
