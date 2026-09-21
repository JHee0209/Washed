// `@/lib/db` 대체 — **드라이버만** 바꾼다 (Issue #58).
//
// src/lib/db.ts 는 process.env.DATABASE_URL 로 neon-http 클라이언트를 만들어
// 모듈 수준 싱글톤으로 들고 있다. 그 파일에는 주입 지점이 없어서, 테스트가 다른
// DB 를 쓰려면 이 모듈 자체를 갈아끼우는 수밖에 없다(resolve-hooks.mjs).
//
// ── 무엇이 같고 무엇이 다른가
// 같다: production 코드가 쓴 **SQL 문자열과 파라미터가 그대로** 나간다. 태그드
//       템플릿을 `$1 · $2 …` 로 조립하는 방식도 neon 과 같고, 돌려주는 것도 행 배열이다.
// 다르다: 보내는 곳이 Neon HTTP 엔드포인트가 아니라 테스트 DB(PGlite)다.
//
// 판정 · 정책은 전부 SQL 안에 있으므로(assignment.ts · expiration.ts · usage.ts 의
// 데이터 수정 CTE), 드라이버를 바꿔도 검증 대상은 진짜 구현 그대로다.
//
// ── executor 가 없으면 시끄럽게 실패한다
// 하네스가 install 하기 전에 누군가 이 모듈을 쓰면 즉시 throw 한다. 조용히 빈 배열을
// 돌려주면 "DB 를 안 건드렸는데 테스트가 통과" 하는 최악의 경우가 생긴다.

/** @type {((text: string, params: unknown[]) => Promise<Record<string, unknown>[]>) | null} */
let executor = null;

/** 테스트 DB 를 연결한다 (test/db-harness.mjs 가 부른다) */
export function installExecutor(next) {
  executor = next;
}

/** 연결을 끊는다 — 테스트가 끝난 뒤 이 모듈이 살아 있어도 쓰이지 않게 한다 */
export function clearExecutor() {
  executor = null;
}

/**
 * src/lib/db.ts 의 `sql` 과 같은 시그니처의 태그드 템플릿.
 *
 *   const rows = await sql`SELECT ... WHERE id = ${value}`;
 */
export function sql(strings, ...values) {
  if (!executor) {
    throw new Error(
      'test/db-bridge.mjs: 테스트 DB 가 연결돼 있지 않습니다. ' +
        'createTestDb() 로 하네스를 먼저 띄우세요 (test/db-harness.mjs).',
    );
  }

  let text = '';
  for (let i = 0; i < strings.length; i += 1) {
    text += strings[i];
    if (i < values.length) text += `$${i + 1}`;
  }

  return executor(text, values);
}
