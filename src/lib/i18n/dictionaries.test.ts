// 네 언어 사전이 서로 어긋나지 않는지 (F37 · 05 P25 · Issue #13 의 6번 · 15번).
//
// 타입(`satisfies Dictionary`)이 이미 key 누락을 막으므로 여기서는 **타입이 못 보는 것**을
// 본다 — 치환 자리 이름이 언어마다 다른 경우, 빈 문자열, 번역을 잊고 한국어를 그대로
// 붙여 둔 경우. 그 셋은 전부 컴파일은 되지만 화면에서 깨진다.
//
// 실행: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DICTS } from './dictionaries.ts';
import { LANGS, type Lang } from './lang.ts';
import { ko } from './ko.ts';

const KO_KEYS = Object.keys(ko).sort();
const TRANSLATED: Lang[] = ['en', 'zh', 'ja'];

/** 한글 — 음절 · 자모 · 호환 자모 */
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

/** 번역문에 한국어가 남아 있어도 되는 자리 (고유명사 등) */
const HANGUL_ALLOWED: ReadonlySet<string> = new Set([]);

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('네 언어 사전 정합성', () => {
  it('사전이 네 개 있고 LANGS 와 짝이 맞는다', () => {
    assert.deepEqual(Object.keys(DICTS).sort(), [...LANGS].sort());
  });

  it('key 집합이 ko 와 완전히 같다', () => {
    for (const lang of LANGS) {
      assert.deepEqual(
        Object.keys(DICTS[lang]).sort(),
        KO_KEYS,
        `${lang} 사전의 key 집합이 ko 와 다릅니다.`,
      );
    }
  });

  it('비어 있거나 공백뿐인 문장이 없다', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(DICTS[lang])) {
        assert.ok(value.trim().length > 0, `${lang}.${key} 가 비어 있습니다.`);
      }
    }
  });

  it('치환 자리 `{name}` 집합이 네 언어에서 같다', () => {
    // 타입이 잡지 못하는 유일한 구멍이다 — 번역문은 그냥 string 이라
    // `{machine}` 을 `{machineName}` 으로 잘못 적어도 컴파일된다.
    for (const key of KO_KEYS) {
      const expected = placeholders(ko[key as keyof typeof ko]);
      for (const lang of TRANSLATED) {
        assert.deepEqual(
          placeholders(DICTS[lang][key as keyof typeof ko]),
          expected,
          `${lang}.${key} 의 치환 자리가 ko 와 다릅니다.`,
        );
      }
    }
  });

  it('짝이 맞지 않는 중괄호가 없다', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(DICTS[lang])) {
        const open = (value.match(/\{/g) ?? []).length;
        const close = (value.match(/\}/g) ?? []).length;
        assert.equal(open, close, `${lang}.${key} 의 중괄호 짝이 맞지 않습니다: ${value}`);
      }
    }
  });

  it('en · zh · ja 에 한국어가 남아 있지 않다', () => {
    // 번역을 잊고 한국어를 복사해 둔 것을 잡는다. 중국어 · 일본어의 한자는
    // 한글 범위가 아니라서 걸리지 않는다.
    for (const lang of TRANSLATED) {
      for (const [key, value] of Object.entries(DICTS[lang])) {
        if (HANGUL_ALLOWED.has(key)) continue;
        assert.ok(!HANGUL.test(value), `${lang}.${key} 에 한국어가 남아 있습니다: ${value}`);
      }
    }
  });
});
