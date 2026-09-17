// src/lib/kst-date.ts 의 KST 날짜 판정을 확인한다 (05 P7 · 08 · 4번).
//
// 실행: npm test
//
// report-rules.test.ts 와 같은 방식이다 — Node 24 내장 테스트 러너(node:test)와
// 타입 스트리핑만 쓰고, `@/` 별칭 대신 상대 경로로 불러온다. isFirstOfMonthInKst 는
// kst-date.ts 에 따로 있다 — expiration.ts 는 `@/lib/db` · `server-only` 를 import 해
// node 가 직접 돌리는 테스트에서 별칭을 못 찾아 실패하기 때문이다.
//
// **여기서 확인하는 것은 DB 없이 판정되는 것뿐이다.** liftExpiredRestrictions ·
// resetMonthlyWarnings 는 DB 가 있어야 해서 이 파일에 없다 — 수동 테스트로 검증한다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isFirstOfMonthInKst } from './kst-date.ts';

describe('isFirstOfMonthInKst — 05 P7 매달 1일 판정은 KST 기준', () => {
  it('KST 1일 00:00 (UTC 로는 전날 15:00) → true', () => {
    // 2026-03-01 00:00 KST = 2026-02-28 15:00 UTC
    assert.equal(isFirstOfMonthInKst(new Date('2026-02-28T15:00:00Z')), true);
  });

  it('KST 1일 23:59 → true', () => {
    // 2026-03-01 23:59 KST = 2026-03-01 14:59 UTC
    assert.equal(isFirstOfMonthInKst(new Date('2026-03-01T14:59:00Z')), true);
  });

  it('KST 2일 00:00 → false', () => {
    // 2026-03-02 00:00 KST = 2026-03-01 15:00 UTC
    assert.equal(isFirstOfMonthInKst(new Date('2026-03-01T15:00:00Z')), false);
  });

  it('KST 월말(말일) → false', () => {
    // 2026-02-28 12:00 KST = 2026-02-28 03:00 UTC
    assert.equal(isFirstOfMonthInKst(new Date('2026-02-28T03:00:00Z')), false);
  });

  it('UTC 로는 아직 1일이 아닌데 KST 로는 이미 1일인 경계 — UTC 만으로 판정하면 틀린다', () => {
    // 2026-05-01 08:00 KST = 2026-04-30 23:00 UTC — UTC 날짜만 보면 30일이라 false 로 잘못 판정한다
    assert.equal(isFirstOfMonthInKst(new Date('2026-04-30T23:00:00Z')), true);
  });
});
