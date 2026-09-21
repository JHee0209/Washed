// 경고 한 건이 **세 화면에서 같은 시각**으로 보이는지 확인한다 (Issue #65).
//
// 실행: npm test
//
// queue-read-only.test.ts 와 같은 방식이다 — 소스를 읽어서 확인한다. notify.ts ·
// expiration.ts · admin-actions.ts 는 `server-only` 와 `@/` 별칭을 쓰고 실제로 부르려면
// DB 가 있어야 해서 직접 import 할 수 없다(이 저장소의 테스트는 DB 없이 도는 것만 둔다).
//
// ── 무엇이 깨질 수 있나
// 경고 INSERT 와 알림 INSERT 는 **별개의 문장**이다(neon-http — 한 문장이 곧 한
// 트랜잭션 · db.ts). 둘이 각자 now() 를 부르면 notifications.received_at 이 항상
// warnings.issued_at 보다 늦어, 관리자 화면(warnings.issued_at)과 알림함
// (notifications.received_at)이 같은 경고를 다른 시각으로 보여준다. 그래서 경고 INSERT
// 가 issued_at 을 RETURNING 하고 그 값이 notify() 까지 **실제로 흘러가는지**를 고정한다.
//
// 주석은 지운 뒤에 찾는다 — 이 저장소의 주석은 SQL 조각과 함수 이름을 설명으로 자주 적는다
// (queue-read-only.test.ts 와 같은 이유).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/** src/lib/ 에 있는 이 파일 기준으로 src/ 를 찾는다 */
const SRC_ROOT = path.resolve(import.meta.dirname, '..');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function read(file: string): string {
  return stripComments(readFileSync(path.join(SRC_ROOT, file), 'utf8'));
}

/**
 * `이름(` 부터 **짝이 맞는** 닫는 괄호까지 — 인자 안의 중첩 괄호를 통째로 집어온다.
 *
 * `[^)]*` 로 자르면 `reason.trim()` 같은 인자의 첫 `)` 에서 끊겨 인자 수를 잘못 센다.
 */
function callsOf(source: string, name: string): string[] {
  const calls: string[] = [];

  for (const match of source.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))) {
    let depth = 0;
    for (let i = match.index + match[0].length - 1; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          calls.push(source.slice(match.index, i + 1));
          break;
        }
      }
    }
  }

  return calls;
}

describe('notify() — 받은 시각을 넘길 수 있다 (Issue #65)', () => {
  const source = read('lib/notify.ts');

  it('notifications INSERT 가 received_at 을 직접 채운다', () => {
    assert.match(
      source,
      /INSERT INTO notifications[^`]*received_at/,
      'notify() 의 INSERT 가 received_at 을 채우지 않습니다 — 경고 시각을 넘길 자리가 사라집니다.',
    );
  });

  it('넘긴 값이 없으면 DB now() 로 떨어진다 — 일반 알림은 기존 동작 그대로다', () => {
    assert.match(
      source,
      /COALESCE\(\$\{[^}]*\}::timestamptz,\s*now\(\)\)/,
      'received_at 이 COALESCE(…, now()) 가 아닙니다 — 배정 · 종료 · 공지 알림의 시각 동작이 바뀝니다.',
    );
  });

  // ── 마이크로초 정밀도 (실측으로 드러난 회귀 · Issue #65)
  //
  // 드라이버가 timestamptz 를 JS Date 로 파싱하는데(pg-types parseDate · OID 1184),
  // Date 는 밀리초까지만 표현한다. 한 번이라도 Date 를 거치면 `.530621` 이 `.530000`
  // 이 되어 알림함 시각이 경고 시각보다 **앞선다**(실측 -621µs → same=false).
  it('receivedAt 은 string 만 받는다 — Date 를 허용하면 절삭이 되살아난다', () => {
    assert.match(
      source,
      /receivedAt\?:\s*string\s*;/,
      'receivedAt 타입이 string 이 아닙니다 — Date 를 받으면 마이크로초가 잘립니다.',
    );
  });

  it('receivedAt 을 JS 로 변환하지 않는다', () => {
    for (const forbidden of [/new Date\(\s*receivedAt/, /receivedAt[^\n]*\.toISOString\(\)/]) {
      assert.equal(
        forbidden.test(source),
        false,
        `notify() 가 receivedAt 을 JS 로 변환합니다(${forbidden}) — 마이크로초가 잘립니다.`,
      );
    }
  });
});

describe('시스템 자동 경고 — warnings.issued_at 이 알림함까지 간다 (Issue #65)', () => {
  const source = read('lib/expiration.ts');

  it('경고 INSERT 가 issued_at 을 RETURNING 한다', () => {
    assert.match(
      source,
      /INSERT INTO warnings[\s\S]*?RETURNING[^\n]*issued_at/,
      'applySystemWarning() 의 경고 INSERT 가 issued_at 을 돌려주지 않습니다.',
    );
  });

  it('issued_at 을 ::text 로 받는다 — 드라이버의 Date 변환을 피한다', () => {
    assert.match(
      source,
      /issued_at::text AS issued_at/,
      'issued_at 을 ::text 로 받지 않습니다 — 드라이버가 JS Date 로 바꾸며 마이크로초를 버립니다.',
    );
  });

  it('그 값을 notify() 의 receivedAt 으로 넘긴다', () => {
    const [call] = callsOf(source, 'notify');
    assert.ok(call, 'expiration.ts 에서 notify() 호출을 찾지 못했습니다.');
    assert.match(
      call,
      /receivedAt:/,
      '자동 경고 알림이 receivedAt 없이 만들어집니다 — 알림함만 늦은 시각을 보게 됩니다.',
    );
  });
});

describe('관리자 수동 경고 — warnings.issued_at 이 알림함까지 간다 (Issue #65)', () => {
  const source = read('lib/admin-actions.ts');

  it('경고 INSERT 가 issued_at 을 ::text 로 RETURNING 한다', () => {
    assert.match(
      source,
      /INSERT INTO warnings[\s\S]*?RETURNING issued_at::text AS issued_at/,
      'insertAdminWarning() 이 issued_at 을 ::text 로 돌려주지 않습니다 — 마이크로초가 잘립니다.',
    );
  });

  it('두 경고 경로 모두 그 값을 applyWarningSideEffects() 로 넘긴다', () => {
    // 선언부(`issuedAt: string`)는 빼고 호출부만 본다.
    const calls = callsOf(source, 'applyWarningSideEffects').filter((c) => !c.includes(': string'));

    // F25 issueWarning() · F28 issueUsageIncidentWarning() 둘 다다.
    assert.equal(calls.length, 2, `applyWarningSideEffects() 호출이 2개가 아닙니다: ${calls.length}개`);
    for (const call of calls) {
      assert.match(
        call,
        /issuedAt/,
        `${call} 가 issued_at 을 안 넘깁니다 — 알림함 시각이 갈립니다.`,
      );
    }
  });

  it('경고 알림이 receivedAt 을 달고 나간다', () => {
    const call = callsOf(source, 'notify').find((c) => c.includes('receivedAt'));
    assert.ok(
      call,
      '관리자 경고 알림이 receivedAt 없이 만들어집니다 — 관리자 화면과 알림함의 시각이 갈립니다.',
    );
  });
});

describe('일반 알림은 시각 정책을 그대로 둔다 (Issue #65 범위 밖)', () => {
  // 배정(#5) · 종료(#9) · 공지(F26)는 만들어진 시각이 곧 받은 시각이라 DB now() 가 정답이다.
  for (const file of ['lib/assignment-notify.ts', 'lib/usage-end-notify.ts']) {
    it(`${file} 은 receivedAt 을 넘기지 않는다`, () => {
      for (const call of callsOf(read(file), 'notify')) {
        assert.equal(
          call.includes('receivedAt'),
          false,
          `${file} 이 receivedAt 을 넘깁니다 — 이 알림의 시각 정책은 #65 범위가 아닙니다.`,
        );
      }
    });
  }

  it('신고 결과 알림(P19)도 receivedAt 을 넘기지 않는다', () => {
    const call = callsOf(read('lib/admin-actions.ts'), 'notify').find((c) => c.includes("'결과'"));
    assert.ok(call, 'setReportStatus() 의 신고 결과 알림 호출을 찾지 못했습니다.');
    assert.equal(
      call.includes('receivedAt'),
      false,
      '신고 결과 알림이 receivedAt 을 넘깁니다 — 이 알림의 시각 정책은 #65 범위가 아닙니다.',
    );
  });

  it('공지(addNotice)는 notify() 를 거치지 않고 received_at 도 DB 몫으로 둔다', () => {
    // 공지는 받는 사람이 전원이라 users 를 훑어 문장 하나로 넣는다(notify() 를 부르지
    // 않는 유일한 알림 경로다) — 시각은 DEFAULT now() 가 채운다.
    const source = read('lib/admin-actions.ts');
    const from = source.indexOf('export async function addNotice');
    assert.notEqual(from, -1, 'addNotice() 를 찾지 못했습니다.');

    const rest = source.slice(from);
    const body = rest.slice(0, rest.indexOf('export async function', 1));

    assert.match(body, /INSERT INTO notifications/, 'addNotice() 의 알림 INSERT 를 찾지 못했습니다.');
    assert.equal(
      /received_at/.test(body),
      false,
      '공지 INSERT 가 received_at 을 직접 채웁니다 — 공지는 경고와 달리 만들어진 시각이 곧 받은 시각입니다.',
    );
  });
});

describe('화면이 읽는 시각 source (Issue #65)', () => {
  it('관리자 경고 내역은 warnings.issued_at 을 읽는다', () => {
    assert.match(
      read('lib/admin-actions.ts'),
      /SELECT[^`]*issued_at[^`]*FROM warnings/,
      'adminWarnings() 가 warnings.issued_at 을 읽지 않습니다.',
    );
  });

  it('사용자 이용기록도 warnings.issued_at 을 읽는다', () => {
    assert.match(
      read('lib/queries.ts'),
      /SELECT[^`]*issued_at[^`]*FROM warnings/,
      'myWarnings() 가 warnings.issued_at 을 읽지 않습니다.',
    );
  });

  it('알림함은 received_at 을 읽는다 — 위 배선 덕분에 그 값이 곧 issued_at 이다', () => {
    assert.match(
      read('lib/notifications.ts'),
      /SELECT[^`]*received_at[^`]*FROM notifications/,
      'getNotifications() 가 received_at 을 읽지 않습니다.',
    );
  });
});
