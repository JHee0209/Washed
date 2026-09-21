// API 오류 code → 번역 key 매핑과 해석 우선순위 (F37 · Issue #13 의 16단계).
//
// 실행: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { API_ERROR_KEY, isApiErrorCode, type ApiErrorCode } from './api-codes.ts';
import { apiErrorText } from './api-error.ts';
import { ko } from './ko.ts';

const CODES = Object.keys(API_ERROR_KEY) as ApiErrorCode[];

describe('code → key 매핑', () => {
  it('가리키는 key 가 모두 사전에 있다', () => {
    // `satisfies` 가 이미 막지만, 사전에서 key 를 지웠을 때를 위한 backstop 이다.
    for (const code of CODES) {
      const key = API_ERROR_KEY[code];
      if (key === null) continue;
      assert.ok(Object.hasOwn(ko, key), `${code} 가 가리키는 ${key} 가 ko 사전에 없습니다.`);
    }
  });

  it('code 이름은 언어와 무관한 대문자 식별자다', () => {
    for (const code of CODES) {
      assert.match(code, /^[A-Z][A-Z0-9_]*$/, `${code} 는 안정적인 식별자 꼴이 아닙니다.`);
    }
  });

  it('isApiErrorCode 는 등록된 값에만 참이다', () => {
    assert.equal(isApiErrorCode('QR_EXPIRED'), true);
    assert.equal(isApiErrorCode('NOPE'), false);
    assert.equal(isApiErrorCode(''), false);
    assert.equal(isApiErrorCode(null), false);
    // 프로토타입 오염으로 엉뚱한 값이 통과하지 않는다
    assert.equal(isApiErrorCode('toString'), false);
    assert.equal(isApiErrorCode('constructor'), false);
  });

  it('의미가 같은 오류는 같은 code 를 쓴다 — 중복 key 매핑이 의도된 것만 있다', () => {
    // 여러 code 가 같은 key 를 가리켜도 되지만(예: 비밀번호 길이), 그것이
    // 실수로 늘어나지 않게 지금 상태를 못 박는다.
    const byKey = new Map<string, ApiErrorCode[]>();
    for (const code of CODES) {
      const key = API_ERROR_KEY[code];
      if (key === null) continue;
      byKey.set(key, [...(byKey.get(key) ?? []), code]);
    }
    const shared = [...byKey.entries()].filter(([, codes]) => codes.length > 1);
    assert.deepEqual(shared, [], `같은 key 를 가리키는 code 가 여럿입니다: ${JSON.stringify(shared)}`);
  });
});

describe('apiErrorText — 해석 우선순위', () => {
  const FALLBACK = '화면이 가진 문구';

  it('1) code 를 알고 key 가 있으면 그 번역을 쓴다 (서버 message 를 이긴다)', () => {
    const text = apiErrorText('ja', { code: 'QR_EXPIRED', message: '인증 가능 시간(10분)이 지났어요.' }, FALLBACK);
    assert.equal(text, '認証可能な時間（10 分）を過ぎました。');
  });

  it('치환 자리에 params 를 끼운다', () => {
    const text = apiErrorText('ko', { code: 'IMAGE_TOO_LARGE', params: { limit: '2MB' } }, FALLBACK);
    assert.equal(text, '사진은 2MB 까지 첨부할 수 있어요.');
  });

  it('2) key 가 null 인 code 는 화면 문구를 쓴다', () => {
    // 「줄서기에 실패했어요」류 — 화면 쪽이 무엇에 실패했는지까지 담고 있다.
    const text = apiErrorText('en', { code: 'QUEUE_JOIN_FAILED', message: '줄서기에 실패했어요.' }, FALLBACK);
    assert.equal(text, FALLBACK);
  });

  it('3) code 가 없으면 서버 message 를 쓴다', () => {
    assert.equal(apiErrorText('en', { message: '서버가 준 문장' }, FALLBACK), '서버가 준 문장');
  });

  it('3) 모르는 code 도 서버 message 로 물러선다', () => {
    assert.equal(apiErrorText('en', { code: 'SOMETHING_NEW', message: '서버 문장' }, FALLBACK), '서버 문장');
  });

  it('code 도 message 도 없으면 화면 문구를 쓴다', () => {
    assert.equal(apiErrorText('en', {}, FALLBACK), FALLBACK);
    assert.equal(apiErrorText('en', null, FALLBACK), FALLBACK);
    assert.equal(apiErrorText('en', undefined, FALLBACK), FALLBACK);
  });

  it('message 가 빈 문자열이면 화면 문구를 쓴다', () => {
    assert.equal(apiErrorText('en', { message: '   ' }, FALLBACK), FALLBACK);
  });

  it('네 언어 모두에서 같은 code 가 각자의 문장을 낸다', () => {
    const texts = (['ko', 'en', 'zh', 'ja'] as const).map((lang) =>
      apiErrorText(lang, { code: 'QUEUE_ALREADY_JOINED' }, FALLBACK),
    );
    assert.equal(new Set(texts).size, 4, `네 언어의 문장이 서로 달라야 합니다: ${JSON.stringify(texts)}`);
    for (const text of texts) assert.notEqual(text, FALLBACK);
  });
});
