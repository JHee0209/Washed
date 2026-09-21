// 언어 값 판정과 저장소 읽기 (F37 · 05 P25 · 06 「언어 설정」 · Issue #13 의 8번).
//
// 「존재하지 않는 값이면 안전하게 ko fallback」이 걸리는 자리가 여기다.
//
// 실행: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_LANG, LANGS, LANG_LABELS, LANG_STORAGE_KEY, isLang, parseLang, readLangFrom } from './lang.ts';

describe('지원 언어', () => {
  it('네 가지이고 기본값은 한국어다 (05 P25)', () => {
    assert.deepEqual([...LANGS], ['ko', 'en', 'zh', 'ja']);
    assert.equal(DEFAULT_LANG, 'ko');
  });

  it('저장소 key 는 08 · 2번에 적힌 이름이다', () => {
    assert.equal(LANG_STORAGE_KEY, 'washed_lang');
  });

  it('언어 이름은 그 언어로 적혀 있다', () => {
    assert.deepEqual(LANG_LABELS, {
      ko: '한국어',
      en: 'English',
      zh: '中文',
      ja: '日本語',
    });
  });
});

describe('parseLang()', () => {
  it('지원하는 값은 그대로 돌려준다', () => {
    for (const lang of LANGS) assert.equal(parseLang(lang), lang);
  });

  it('모르는 값은 전부 한국어다', () => {
    for (const bad of [null, undefined, '', 'de', 'KO', 'ja-JP', 'ko-KR', 0, {}, []]) {
      assert.equal(parseLang(bad), 'ko', `${JSON.stringify(bad)} 가 ko 로 떨어지지 않았습니다.`);
    }
  });

  it('isLang 은 네 값에만 참이다', () => {
    assert.equal(isLang('zh'), true);
    assert.equal(isLang('ZH'), false);
    assert.equal(isLang(null), false);
  });
});

describe('readLangFrom()', () => {
  it('저장된 값을 읽는다', () => {
    const storage = { getItem: (k: string) => (k === LANG_STORAGE_KEY ? 'zh' : null) };
    assert.equal(readLangFrom(storage), 'zh');
  });

  it('저장된 값이 없으면 한국어다', () => {
    assert.equal(readLangFrom({ getItem: () => null }), 'ko');
  });

  it('쓰레기 값이 들어 있어도 한국어다', () => {
    assert.equal(readLangFrom({ getItem: () => 'klingon' }), 'ko');
  });

  it('저장소 자체가 없어도 한국어다 (서버 렌더)', () => {
    assert.equal(readLangFrom(null), 'ko');
    assert.equal(readLangFrom(undefined), 'ko');
  });

  it('읽다가 예외가 나도 한국어다 (사파리 프라이빗 · 사이트 데이터 차단)', () => {
    const throwing = {
      getItem() {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    assert.equal(readLangFrom(throwing), 'ko');
  });
});
