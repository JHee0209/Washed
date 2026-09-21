// 관리자 사용자 검색 (F29 · Issue #86).
//
// tabs.tsx 의 Users 탭이 쓰는 판정 규칙만 여기서 검증한다 — 화면은 이 함수를 그대로 부른다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterUsersBySearch, normalizeSearchText } from './user-search.ts';

/** adminUsers() 행에서 검색에 쓰는 칸만 추린 모양이다. 실제 행에는 칸이 더 있다. */
const rows = [
  { user_id: 'u1', name: '김세탁', email: 'ilsan@g.eulji.ac.kr', student_id: '20231234' },
  { user_id: 'u2', name: '박건조', email: 'parkgj@g.eulji.ac.kr', student_id: '20239876' },
  { user_id: 'u3', name: '이수거', email: 'soogeo@g.eulji.ac.kr', student_id: '20201111' },
];

const names = (result: readonly { name: string }[]) => result.map((u) => u.name);

describe('normalizeSearchText', () => {
  it('앞뒤 공백을 떼고 소문자로 만든다', () => {
    assert.equal(normalizeSearchText('  ILSAN@G.EULJI.AC.KR  '), 'ilsan@g.eulji.ac.kr');
  });

  it('문자열이 아니면 빈 문자열이다 — null · undefined 에서 터지지 않는다', () => {
    for (const raw of [null, undefined, 123, {}, []]) {
      assert.equal(normalizeSearchText(raw), '');
    }
  });
});

describe('filterUsersBySearch', () => {
  it('검색어가 비어 있으면 전체 목록이다', () => {
    const result = filterUsersBySearch(rows, '');
    assert.equal(result.length, rows.length);
    assert.deepEqual(result, rows);
  });

  it('공백만 있는 검색어도 전체 목록이다', () => {
    assert.deepEqual(filterUsersBySearch(rows, '   '), rows);
  });

  it('이름 전체로 찾는다', () => {
    assert.deepEqual(names(filterUsersBySearch(rows, '김세탁')), ['김세탁']);
  });

  it('이름 일부로 찾는다', () => {
    assert.deepEqual(names(filterUsersBySearch(rows, '세탁')), ['김세탁']);
  });

  it('이메일 일부로 찾는다', () => {
    assert.deepEqual(names(filterUsersBySearch(rows, 'parkgj')), ['박건조']);
  });

  it('이메일 검색은 대소문자를 가리지 않는다', () => {
    // 저장된 값은 normalizeEmail() 로 소문자다 — 관리자가 대문자로 쳐도 찾혀야 한다
    assert.deepEqual(names(filterUsersBySearch(rows, 'ILSAN')), ['김세탁']);
    assert.equal(filterUsersBySearch(rows, 'G.EULJI.AC.KR').length, 3);
  });

  it('학번 일부로 찾는다', () => {
    assert.deepEqual(names(filterUsersBySearch(rows, '9876')), ['박건조']);
  });

  it('검색어 앞뒤 공백은 무시한다', () => {
    assert.deepEqual(names(filterUsersBySearch(rows, '  세탁  ')), ['김세탁']);
    assert.deepEqual(names(filterUsersBySearch(rows, '  20201111 ')), ['이수거']);
  });

  it('여러 사람이 걸리면 원래 순서대로 모두 돌려준다', () => {
    // '2023' 은 김세탁 · 박건조의 학번에만 있다
    assert.deepEqual(names(filterUsersBySearch(rows, '2023')), ['김세탁', '박건조']);
  });

  it('맞는 사람이 없으면 빈 목록이다', () => {
    assert.deepEqual(filterUsersBySearch(rows, '없는사람'), []);
  });

  it('검색어를 지우면 전체 목록이 그대로 돌아온다', () => {
    assert.equal(filterUsersBySearch(rows, '세탁').length, 1);
    assert.deepEqual(filterUsersBySearch(rows, ''), rows);
  });

  it('걸러낸 행은 원본 객체 그대로다 — 경고 부여가 엉뚱한 사용자에게 가지 않는다', () => {
    const result = filterUsersBySearch(rows, '박건조');
    assert.equal(result.length, 1);
    assert.equal(result[0], rows[1]); // 참조가 같다 (node:assert/strict 의 equal 은 ===)
    assert.equal(result[0].user_id, 'u2');
  });

  it('이름 · 이메일 · 학번이 null 이거나 없어도 터지지 않는다', () => {
    // sql<T> 는 검사 없는 캐스트라 타입이 string 이어도 런타임에 null 이 올 수 있다
    const broken = [
      { user_id: 'x1', name: null, email: undefined, student_id: null },
      { user_id: 'x2', name: '정상', email: 'ok@g.eulji.ac.kr', student_id: '20240000' },
    ] as unknown as typeof rows;

    assert.deepEqual(names(filterUsersBySearch(broken, '정상')), ['정상']);
    assert.deepEqual(filterUsersBySearch(broken, '없는값'), []);
  });

  it('검색어 중간의 공백은 떼지 않는다 — 부분 문자열 그대로 본다', () => {
    // 의도한 한계다. '홍 길동' 으로 '홍길동' 을 찾지는 못한다.
    assert.deepEqual(filterUsersBySearch(rows, '김 세탁'), []);
  });
});
