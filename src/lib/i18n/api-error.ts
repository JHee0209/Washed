// 서버가 준 오류를 화면 문구로 바꾼다 (F37 · Issue #13 의 16단계).
//
// api-codes.ts 와 따로 두는 이유: 그쪽은 **서버 route 도 import** 하는데(code 타입),
// 이 파일은 네 언어 사전을 전부 끌어온다. 섞어 두면 서버 번들에 사전 넷이 들어간다.
//
// React 를 import 하지 않는다 — node --test 가 그대로 부른다.

import { API_ERROR_KEY, isApiErrorCode } from './api-codes.ts';
import type { Lang } from './lang.ts';
import { interpolate, lookup } from './translate.ts';
import type { MessageParams } from './types.ts';

/**
 * 우선순위 (api-codes.ts 의 주석과 같다)
 *
 *   1. code 를 알고 key 가 있으면        → 그 번역 (params 치환)
 *   2. code 를 알지만 key 가 null 이면    → 화면이 넘긴 fallback
 *                                          (「줄서기에 실패」처럼 무엇에 실패했는지가
 *                                           담긴 문구라 서버의 일반 문장보다 낫다)
 *   3. code 가 없거나 모르는 값이면       → 서버 message → fallback
 *
 * 3번에서 서버 message 가 한국어인 것은 알고 있다 — 사전에 없는 문장은 한국어로
 * 보이는 것이 이 Issue 가 정한 fallback 이다(6번). code 를 붙이지 않은 응답이
 * 남아 있어도 화면이 깨지지 않게 하려는 자리다.
 *
 * `body` 를 `unknown` 으로 받는 이유는 `res.json()` 의 결과가 그것이기 때문이다 —
 * 캐스팅해서 믿지 않고 여기서 모양을 확인한다.
 */
export function apiErrorText(lang: Lang, body: unknown, fallback: string): string {
  const parsed = body as
    | { code?: unknown; params?: unknown; message?: unknown }
    | null
    | undefined;

  const code = parsed?.code;
  if (isApiErrorCode(code)) {
    const key = API_ERROR_KEY[code];
    if (key === null) return fallback;

    const params =
      parsed?.params && typeof parsed.params === 'object'
        ? (parsed.params as MessageParams)
        : undefined;
    return interpolate(lookup(lang, key), params);
  }

  const message = parsed?.message;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}
