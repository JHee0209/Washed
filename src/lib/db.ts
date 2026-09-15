// Neon Postgres 연결 — 서버에서만 쓴다.
//
// 첫 줄의 `import 'server-only'` 때문에 이 파일을 클라이언트 컴포넌트에서 import 하면
// 빌드가 실패한다. 접속 문자열이 클라이언트 번들에 들어갈 일이 없다.
// (환경변수 이름에 NEXT_PUBLIC_ 접두사를 붙이지 않는 것도 같은 이유다.)
//
// 평소 쿼리는 DATABASE_URL(풀링)을 쓴다.
// 스키마 적용 · 마이그레이션만 DATABASE_URL_UNPOOLED(직접 연결)를 쓰고,
// 그것은 scripts/db-push.mjs 쪽에 있다.
//
// 표와 칸은 db/schema.sql 에 있다 (docs/06-data.md · docs/05-policy.md).

import 'server-only';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      '.env.local 에 DATABASE_URL 이 없습니다. Neon 콘솔의 풀링 연결 문자열을 넣어주세요.',
    );
  }

  client = neon(connectionString);
  return client;
}

/**
 * 태그드 템플릿으로 쓴다. 값은 항상 매개변수로 나가므로 문자열을 이어 붙이지 않는다.
 *
 *   const rows = await sql<{ user_id: string }>`
 *     SELECT user_id FROM users WHERE email = ${email}
 *   `;
 */
export function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return getClient()(strings, ...values) as Promise<T[]>;
}
