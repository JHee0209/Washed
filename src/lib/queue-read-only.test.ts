// GET /api/queue 가 **아무것도 바꾸지 않는지** 확인한다 (Issue #35).
//
// 실행: npm test
//
// expiration.test.ts 와 같은 방식이다 — Node 내장 테스트 러너(node:test)와 타입
// 스트리핑만 쓴다. 다만 이 파일은 **소스를 읽어서** 확인한다. 라우트를 직접 import 할
// 수 없기 때문이다: route.ts 는 `server-only` 와 `@/` 별칭을 쓰고, 실제로 부르려면
// DB 와 세션이 필요하다(이 저장소의 테스트는 DB 없이 도는 것만 둔다).
//
// ── 왜 라우트 파일만 보지 않는가
// route.ts 에서 UPDATE 가 사라진 것만으로는 부족하다. `GET → helper A → helper B →
// UPDATE` 면 여전히 조회가 쓰기를 한다. 그래서 라우트에서 시작해 **프로젝트 안의
// import 를 따라가며** 닿는 모든 파일을 훑는다(next-auth · react 같은 외부 패키지는
// 건너뛴다 — 이 저장소가 고칠 수 있는 코드가 아니다).
//
// 주석은 지운 뒤에 찾는다 — 이 저장소의 주석은 UPDATE · DELETE 를 설명으로 자주
// 적는다(예: facility-status.ts 의 「UPDATE 한 줄이라…」).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/** src/lib/ 에 있는 이 파일 기준으로 src/ 를 찾는다 */
const SRC_ROOT = path.resolve(import.meta.dirname, '..');

const GET_QUEUE_ROUTE = 'app/api/queue/route.ts';
const SWEEP_ROUTE = 'app/api/queue/sweep/route.ts';

/**
 * 쓰기 SQL. `sql` 템플릿 안에 있으므로 문자열로 찾는다.
 *
 * 뒤에 **표 이름의 첫 글자**(`[a-z_"]`)를 붙여 둔다 — `UPDATE` 뒤에 `\b` 만 두면
 * 표 이름이 한 글자일 때만 걸려(`\w` 다음이 또 글자면 경계가 아니다) `UPDATE
 * facility_status` 같은 실제 쓰기를 놓친다. 산문("update 는 …")은 공백 뒤가 한글이라
 * 걸리지 않고, `updates` 처럼 붙어 있는 낱말도 공백 조건에서 걸러진다.
 */
const WRITE_SQL = /\b(UPDATE\s+[a-z_"]|INSERT\s+INTO\s+[a-z_"]|DELETE\s+FROM\s+[a-z_"])/i;

/**
 * 주석을 지운다.
 *
 * `//` 는 앞에 `:` 가 없을 때만 주석으로 본다 — `https://` 같은 URL 문자열을 잘라
 * 뒤에 오는 코드를 함께 지우지 않기 위해서다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** import 대상 중 **이 저장소 안의 파일**만 돌려준다 (외부 패키지는 건너뛴다) */
function localImportsOf(source: string, fromFile: string): string[] {
  const specs = [...source.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((m) => m[1]);
  const resolved: string[] = [];

  for (const spec of specs) {
    let base: string;
    if (spec.startsWith('@/')) {
      base = path.join(SRC_ROOT, spec.slice(2));
    } else if (spec.startsWith('.')) {
      base = path.resolve(SRC_ROOT, path.dirname(fromFile), spec);
    } else {
      continue; // next · react · node: · next-auth …
    }

    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
      try {
        readFileSync(candidate, 'utf8');
        resolved.push(path.relative(SRC_ROOT, candidate).split(path.sep).join('/'));
        break;
      } catch {
        // 다음 후보 확장자를 본다
      }
    }
  }

  return resolved;
}

/** 시작 파일에서 import 를 따라가며 닿는 저장소 안 파일 전부 */
function reachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(path.join(SRC_ROOT, file), 'utf8');
    for (const next of localImportsOf(source, file)) {
      if (!seen.has(next)) queue.push(next);
    }
  }

  return [...seen];
}

describe('GET /api/queue — 조회는 상태를 바꾸지 않는다 (Issue #35)', () => {
  it('라우트 파일 자체에 쓰기 SQL 이 없다', () => {
    const source = stripComments(readFileSync(path.join(SRC_ROOT, GET_QUEUE_ROUTE), 'utf8'));
    assert.equal(
      WRITE_SQL.test(source),
      false,
      'GET /api/queue 에 쓰기 SQL 이 생겼습니다. 상태 변경은 POST /api/queue/sweep 으로 보내주세요.',
    );
  });

  it('상태를 바꾸는 모듈을 import 하지 않는다', () => {
    const source = stripComments(readFileSync(path.join(SRC_ROOT, GET_QUEUE_ROUTE), 'utf8'));
    const mutationModules = ['@/lib/expiration', '@/lib/assignment', '@/lib/usage', '@/lib/cleanup'];

    for (const mod of mutationModules) {
      assert.equal(
        source.includes(`from '${mod}'`),
        false,
        `GET /api/queue 가 ${mod} 을 import 합니다 — 조회 라우트에서 상태를 바꾸면 안 됩니다.`,
      );
    }
  });

  it('import 를 따라간 호출 그래프 전체가 read-only 다', () => {
    const files = reachableFrom(GET_QUEUE_ROUTE);

    // 그래프를 실제로 걸었는지 — 라우트 한 개만 보고 통과하면 의미가 없다.
    assert.ok(files.length > 1, `import 그래프를 따라가지 못했습니다: ${files.join(', ')}`);
    assert.ok(files.includes('lib/queries.ts'), 'queries.ts 가 그래프에 없습니다.');

    const writers = files.filter((file) =>
      WRITE_SQL.test(stripComments(readFileSync(path.join(SRC_ROOT, file), 'utf8'))),
    );

    assert.deepEqual(
      writers,
      [],
      `GET /api/queue 에서 닿는 파일에 쓰기 SQL 이 있습니다: ${writers.join(', ')}`,
    );
  });
});

describe('POST /api/queue/sweep — 분리된 전환 경로가 살아 있다 (Issue #35)', () => {
  it('사용중 → 수거대기 전환 함수를 부른다', () => {
    const source = stripComments(readFileSync(path.join(SRC_ROOT, SWEEP_ROUTE), 'utf8'));

    // 05 P5 · F9 — 이 호출이 사라지면 자동 종료 기능 자체가 사라진다(#35 범위 밖).
    assert.ok(
      source.includes('transitionUsageToPickup'),
      'sweep 라우트가 transitionUsageToPickup() 을 부르지 않습니다 — 자동 종료가 사라집니다.',
    );
    assert.ok(source.includes('POST'), 'sweep 은 POST 여야 합니다 (조회가 아니라 상태 변경).');
  });
});
