// db/schema.sql 을 Neon Postgres 에 적용한다.  실행: npm run db:push
//
// 접속 정보는 .env.local 에서 읽는다 (.gitignore 에 .env* 가 있다).
// 스키마 적용 · 마이그레이션은 풀링을 거치지 않는 직접 연결을 쓴다
//   → DATABASE_URL_UNPOOLED
// 평소 쿼리는 src/lib/db.ts 가 DATABASE_URL(풀링) 을 쓴다.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { strictSsl } from './strict-ssl.mjs';

const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));
const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  console.error(
    '\n.env.local 에 DATABASE_URL_UNPOOLED 가 없습니다.\n' +
      'Neon 콘솔의 Connection string 에서 "Direct connection" 값을 넣어주세요.\n',
  );
  process.exit(1);
}

const schema = await readFile(schemaPath, 'utf8');
const client = new pg.Client({ connectionString: strictSsl(connectionString) });

try {
  await client.connect();

  // schema.sql 이 BEGIN · COMMIT 을 가지고 있어 전부 적용되거나 전부 안 되거나 둘 중 하나다.
  await client.query(schema);

  const { rows } = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);

  console.log(`\n스키마를 적용했습니다. 테이블 ${rows.length}개:`);
  for (const row of rows) console.log(`  · ${row.table_name}`);
  console.log('\n06-data.md 의 저장 항목 10개 중 「언어 설정」은 기기 단위라 테이블이 없습니다 → 9개.\n');
} catch (error) {
  console.error('\n스키마 적용에 실패했습니다.\n');
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
