// 번역 조회 · fallback · 치환 (F37 · Issue #13 의 6번 「fallback」).
//
// 「사전에 번역이 없는 문장은 오류 없이 한국어를 그대로 표시한다」가 걸리는 자리다.
//
// 실행: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ko } from './ko.ts';
import { interpolate, lookup, splitSlots, translate } from './translate.ts';

describe('lookup() — fallback 사슬', () => {
  it('고른 언어의 문장을 돌려준다', () => {
    assert.equal(lookup('ja', 'nav.home'), 'ホーム');
    assert.equal(lookup('zh', 'nav.home'), '首页');
    assert.equal(lookup('en', 'nav.home'), 'Home');
  });

  it('한국어는 ko 사전 그대로다', () => {
    assert.equal(lookup('ko', 'nav.home'), ko['nav.home']);
  });

  it('사전에 없는 key 는 한국어로 물러선다', () => {
    // 실제로는 타입이 막지만, 캐스팅하거나 동적으로 만든 key 가 이 길로 온다.
    // 여기서 undefined 가 새어 나가면 화면에 "undefined" 가 찍힌다.
    const holed = { ...ko } as Record<string, string>;
    assert.equal(typeof holed['nav.settings'], 'string');
    assert.equal(lookup('ja', 'nav.settings'), '設定');
  });

  it('어느 사전에도 없으면 key 자체를 돌려준다 — 절대 undefined 가 아니다', () => {
    assert.equal(lookup('ja', 'nope.not.here'), 'nope.not.here');
    assert.equal(lookup('ko', 'nope.not.here'), 'nope.not.here');
  });
});

describe('interpolate()', () => {
  it('이름으로 치환한다', () => {
    assert.equal(interpolate('{machine} 이용 중', { machine: '세탁기 3호기' }), '세탁기 3호기 이용 중');
  });

  it('숫자도 받는다', () => {
    assert.equal(interpolate('앞에 {count}명', { count: 3 }), '앞에 3명');
  });

  it('같은 이름이 두 번 나와도 둘 다 바뀐다', () => {
    assert.equal(interpolate('{a} 와 {a}', { a: 'x' }), 'x 와 x');
  });

  it('언어마다 어순이 달라도 이름으로 찾으므로 그대로 동작한다', () => {
    assert.equal(
      interpolate('{count} people ahead of {machine}', { machine: 'Washer 3', count: 2 }),
      '2 people ahead of Washer 3',
    );
  });

  it('넘기지 않은 이름은 그대로 남는다 — 던지지 않는다', () => {
    assert.equal(interpolate('{a} / {b}', { a: '1' }), '1 / {b}');
  });

  it('params 가 없으면 원문 그대로다', () => {
    assert.equal(interpolate('치환 없음'), '치환 없음');
  });

  it('프로토타입 사전을 흉내낸 상속 속성은 치환하지 않는다', () => {
    // Object.hasOwn 을 쓰는 이유 — toString 같은 이름이 들어와도 함수가 찍히면 안 된다
    assert.equal(interpolate('{toString}', {}), '{toString}');
  });
});

describe('translate()', () => {
  it('조회와 치환을 함께 한다', () => {
    assert.equal(translate('ja', 'nav.history'), '履歴');
  });

  it('치환 자리가 없는 key 는 인자 없이 부른다', () => {
    assert.equal(translate('en', 'common.cancel'), 'Cancel');
  });
});

describe('splitSlots() — 문장 가운데에 ReactNode 를 끼우는 자리', () => {
  it('앞뒤 문자열과 자리를 순서대로 쪼갠다', () => {
    assert.deepEqual(splitSlots('아래 {share} 를 누르세요'), [
      '아래 ',
      { slot: 'share' },
      ' 를 누르세요',
    ]);
  });

  it('자리가 여러 개여도 순서를 지킨다', () => {
    assert.deepEqual(splitSlots('{a}{b}'), [{ slot: 'a' }, { slot: 'b' }]);
  });

  it('문장 맨 앞과 맨 뒤의 자리도 잡는다', () => {
    assert.deepEqual(splitSlots('{only}'), [{ slot: 'only' }]);
    assert.deepEqual(splitSlots('끝에 {x}'), ['끝에 ', { slot: 'x' }]);
  });

  it('자리가 없으면 문자열 하나다', () => {
    assert.deepEqual(splitSlots('그냥 문장'), ['그냥 문장']);
  });

  it('빈 문자열은 조각이 없다', () => {
    assert.deepEqual(splitSlots(''), []);
  });
});
