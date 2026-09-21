// 만료 스케줄러의 **구조**를 고정한다 (Issue #8 · 05 P3 · P5 · P6 · P7 · 08 · 4번).
//
// 실행: npm test
//
// queue-read-only.test.ts 와 같은 방식의 **소스 텍스트 검사**다. scheduler.ts 도
// expiration.ts 도 `server-only` 와 `@/lib/db` 를 import 해서 테스트에서 직접 부를 수
// 없다(expiration.test.ts:10-11 이 같은 이유로 kst-date.ts 만 본다). 실제 만료 판정이
// 맞는지는 DB 가 있어야 확인할 수 있어 수동 테스트로 검증한다 — 여기서 지키는 것은
// **판정을 어디에 두기로 했는지**, 즉 되돌아가기 쉬운 구조적 약속뿐이다.
//
// 지키는 약속 넷:
//   1. 스케줄러 라우트는 CRON_SECRET 으로 막혀 있다 (아무나 경고를 매길 수 없다)
//   2. scheduler.ts 는 판정 SQL 을 직접 갖지 않는다 (중복 구현 금지 · 기존 함수 재사용)
//   3. 다섯 단계가 정해진 순서로, drainQueue 는 **한 번만** 불린다 (queue 두 칸 진행 금지)
//   4. resetMonthlyWarnings 는 이 스윕에 없다 (분 단위로 돌면 그날 경고까지 지운다)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/** src/lib/ 에 있는 이 파일 기준으로 src/ 를 찾는다 */
const SRC_ROOT = path.resolve(import.meta.dirname, '..');

const SCHEDULER = 'lib/scheduler.ts';
const CRON_ROUTE = 'app/api/cron/expiration/route.ts';
const CLEANUP_ROUTE = 'app/api/cron/cleanup/route.ts';

/** queue-read-only.test.ts 의 같은 정규식 — 표 이름 첫 글자까지 붙여 산문과 가른다 */
const WRITE_SQL = /\b(UPDATE\s+[a-z_"]|INSERT\s+INTO\s+[a-z_"]|DELETE\s+FROM\s+[a-z_"])/i;

/** 주석을 지운다 — 이 저장소의 주석은 SQL 을 설명으로 자주 적는다 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function read(file: string): string {
  return stripComments(readFileSync(path.join(SRC_ROOT, file), 'utf8'));
}

describe('GET /api/cron/expiration — 아무나 부를 수 없다 (08 · 4번)', () => {
  it('공용 cron 인증을 거친다', () => {
    const source = read(CRON_ROUTE);

    assert.ok(
      source.includes('isAuthorizedCronRequest'),
      '스케줄러 라우트가 cron 인증을 거치지 않습니다 — 누구나 경고를 매길 수 있게 됩니다.',
    );
    assert.ok(source.includes('401'), '인증 실패 시 401 을 돌려줘야 합니다.');
  });

  it('cleanup 라우트와 같은 인증 helper 를 쓴다', () => {
    // 두 라우트가 각자 검사를 베껴 두면 한쪽만 고쳐질 수 있다.
    assert.ok(
      read(CLEANUP_ROUTE).includes('isAuthorizedCronRequest'),
      'cleanup 라우트가 공용 cron 인증을 쓰지 않습니다.',
    );
  });

  it('캐시되지 않는다', () => {
    // 캐시되면 두 번째 호출이 아무것도 처리하지 않고 200 만 돌려준다.
    assert.ok(
      read(CRON_ROUTE).includes("dynamic = 'force-dynamic'"),
      "스케줄러 라우트에 force-dynamic 이 없습니다 — 캐시된 응답은 만료를 처리하지 않습니다.",
    );
  });
});

describe('scheduler.ts — 판정을 새로 구현하지 않는다 (Issue #8)', () => {
  it('SQL 을 직접 갖지 않는다', () => {
    const source = read(SCHEDULER);

    assert.equal(
      WRITE_SQL.test(source),
      false,
      'scheduler.ts 에 쓰기 SQL 이 생겼습니다 — 만료 판정은 expiration.ts 에만 두고 여기서는 부르기만 해야 합니다.',
    );
  });

  it('기존 스윕 함수를 그대로 부른다', () => {
    const source = read(SCHEDULER);

    for (const fn of [
      'expireOverdueAssignments',
      'transitionFinishedUsageToPickup',
      'expireOverduePickups',
      'drainQueue',
      'liftExpiredRestrictions',
    ]) {
      assert.ok(source.includes(fn), `scheduler.ts 가 ${fn}() 을 부르지 않습니다.`);
    }
  });
});

describe('실행 순서 (05 P2 · P3 · P5 · P7)', () => {
  /** 호출부의 위치. import 목록에서도 이름이 나오므로 `(` 가 붙은 자리를 찾는다 */
  function callIndex(source: string, fn: string): number {
    return source.indexOf(`${fn}(`, source.indexOf('runExpirationSweep'));
  }

  it('배정 만료 → 수거대기 전환 → 수거 만료 → 배정 → 제한 해제 순이다', () => {
    const source = read(SCHEDULER);

    const order = [
      'expireOverdueAssignments',
      'transitionFinishedUsageToPickup',
      'expireOverduePickups',
      'drainQueue',
      'liftExpiredRestrictions',
    ].map((fn) => ({ fn, at: callIndex(source, fn) }));

    for (const { fn, at } of order) {
      assert.ok(at > 0, `${fn}() 호출을 찾지 못했습니다.`);
    }

    for (let i = 1; i < order.length; i += 1) {
      assert.ok(
        order[i - 1].at < order[i].at,
        `${order[i - 1].fn}() 이 ${order[i].fn}() 보다 뒤에 있습니다 — ` +
          '기기를 푸는 단계가 모두 끝난 뒤에 배정해야 합니다.',
      );
    }
  });

  it('drainQueue 는 한 회차에 한 번만 부른다', () => {
    // 단계마다 부르면 같은 회차에서 queue 가 두 칸 진행된다.
    const calls = read(SCHEDULER).match(/drainQueue\(/g) ?? [];
    assert.equal(calls.length, 1, `drainQueue() 호출이 ${calls.length}번입니다 — 한 번이어야 합니다.`);
  });

  it('매달 1일 초기화는 이 스윕에 없다 (05 P7)', () => {
    // 이 스윕은 분 단위로도 돈다. 여기서 초기화하면 1일 하루 내내 매 회차마다
    // 누적을 0 으로 밀어 그날 새로 쌓인 경고까지 지워 버린다 — 하루 1회 배치의 몫이다.
    assert.ok(
      !read(SCHEDULER).includes('resetMonthlyWarnings'),
      'scheduler.ts 가 resetMonthlyWarnings() 를 부릅니다 — 1일 하루 종일 경고가 지워집니다. cleanup.ts 에 두세요.',
    );
    assert.ok(
      read('lib/cleanup.ts').includes('resetMonthlyWarnings'),
      'cleanup.ts 에서 resetMonthlyWarnings() 가 사라졌습니다 — 매달 1일 초기화가 없어집니다.',
    );
  });
});

describe('경고 중복 방지 (05 P6 · 0008 · 0012 · 0013)', () => {
  it('시스템 자동 경고가 사건 키를 채운다', () => {
    const source = read('lib/expiration.ts');

    assert.ok(
      source.includes('incident_queue_id'),
      'expiration.ts 가 incident_queue_id 를 채우지 않습니다 — 같은 사건에 경고가 두 번 쌓일 수 있습니다.',
    );
    assert.ok(
      source.includes('warnings_incident_queue_id_idx'),
      '사건 키 UNIQUE 위반(23505)을 다루지 않습니다 — 스케줄러 재시도가 예외로 끝납니다.',
    );
    assert.ok(
      source.includes('warnings_usage_history_id_idx'),
      '0008 의 관리자 교차 중복 방지(usage_history_id)를 다루지 않습니다.',
    );
  });

  it('이용 내역을 만드는 두 곳이 모두 원래 줄서기를 남긴다 (0013)', () => {
    // 이 값이 빠지면 만료 뒤 사건 이름이 사라져, 관리자가 같은 사건에 두 번째 경고를
    // 줄 수 있게 된다 — canonical 사건 키 설계가 통째로 무너지는 자리다.
    for (const file of ['lib/usage.ts', 'lib/expiration.ts']) {
      const source = read(file);
      assert.ok(
        // `s` 플래그를 쓰지 않는다 — 부정 문자 클래스는 원래 줄바꿈도 포함하고,
        // 이 저장소의 tsconfig target 에서는 그 플래그가 막혀 빌드가 깨진다.
        /INSERT INTO usage_history[^`]*source_queue_id/.test(source),
        `${file} 의 usage_history INSERT 에 source_queue_id 가 없습니다.`,
      );
    }
  });

  it('관리자 경고가 이용 내역을 canonical 줄서기 키로 되짚는다 (0013)', () => {
    const source = read('lib/admin-actions.ts');

    assert.ok(
      source.includes('source_queue_id'),
      'admin-actions.ts 가 source_queue_id 를 읽지 않습니다 — 관리자가 고른 이용 건이 ' +
        '자동 경고와 같은 사건인지 판별할 수 없습니다.',
    );
    assert.ok(
      source.includes('requiresWarningIncident'),
      '자동 경고와 겹치는 사유에 사건을 요구하지 않습니다 — 사건 없이 주면 중복 방지가 비켜갑니다.',
    );
    assert.ok(
      source.includes('isWarningIncidentRef'),
      '클라이언트가 보낸 사건 참조를 런타임 검증하지 않습니다.',
    );
  });

  it('사후 backfill 방식으로 되돌아가지 않았다', () => {
    // 만료 후 별도 문장으로 이어 붙이는 방식은 usage_history 가 밖에 보이는 시점과
    // 연결 시점 사이에 관리자 요청이 끼어들어 경고가 두 줄 남을 수 있었다. 0013 의
    // canonical 키로 그 구조 자체를 없앴으므로 다시 들어오면 안 된다.
    const source = read('lib/expiration.ts');
    assert.ok(
      !source.includes('repairIncidentLink') && !source.includes('linkIncidentUsageHistory'),
      'expiration.ts 에 사후 backfill 이 다시 생겼습니다 — 0013 의 canonical 키를 쓰세요.',
    );
  });
});
