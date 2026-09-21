// KST 날짜 열쇠 (Issue #86) — 관리자 이용 내역 날짜 필터의 기준이다.
//
// isFirstOfMonthInKst 는 05 P7(매달 1일 초기화) 쪽 테스트인 expiration.test.ts 에 있다.
// 여기서는 seoulDayKey 만 본다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { seoulDayKey } from './kst-date.ts';

describe('seoulDayKey', () => {
  it("<input type='date'> 와 같은 YYYY-MM-DD 형식이다", () => {
    assert.match(seoulDayKey('2026-09-21T03:00:00.000Z'), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('KST 하루의 경계에서 날짜가 넘어간다 (UTC+9)', () => {
    // UTC 14:59:59 = KST 23:59:59 — 아직 같은 날
    assert.equal(seoulDayKey('2026-09-20T14:59:59.000Z'), '2026-09-20');
    // UTC 15:00:00 = KST 다음 날 00:00:00
    assert.equal(seoulDayKey('2026-09-20T15:00:00.000Z'), '2026-09-21');
  });

  it('KST 새벽에 시작한 이용이 전날로 새지 않는다', () => {
    // UTC 로 날짜만 자르면 09-20 이 되는 값이다 — 필터가 어긋나던 자리.
    assert.equal(seoulDayKey('2026-09-20T16:30:00.000Z'), '2026-09-21');
    assert.equal(seoulDayKey('2026-09-20T23:10:00.000Z'), '2026-09-21');
  });

  it('KST 밤 늦게 시작한 이용이 다음 날로 새지 않는다', () => {
    assert.equal(seoulDayKey('2026-09-21T13:40:00.000Z'), '2026-09-21');
  });

  it('달 · 해가 바뀌는 경계도 KST 기준으로 넘어간다', () => {
    assert.equal(seoulDayKey('2026-08-31T14:59:59.000Z'), '2026-08-31');
    assert.equal(seoulDayKey('2026-08-31T15:00:00.000Z'), '2026-09-01');
    assert.equal(seoulDayKey('2026-12-31T15:00:00.000Z'), '2027-01-01');
  });

  it('Date 객체도 문자열과 같은 값을 준다', () => {
    const iso = '2026-09-20T15:00:00.000Z';
    assert.equal(seoulDayKey(new Date(iso)), seoulDayKey(iso));
  });
});
