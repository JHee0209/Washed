// db/migrations/ 안에서 아직 적용하지 않은 것만 순서대로 적용한다.  실행: npm run db:migrate
//
// 스키마를 바꾸는 일은 전부 여기를 지난다. 규칙은 db/migrations/README.md 에 있다.
//   · 파일 이름은 0002_무엇을_한다.sql 처럼 네 자리 번호 + 하는 일
//   · 한 파일 = 한 트랜잭션. 파일 안에 BEGIN · COMMIT 을 적지 않는다
//   · 이미 적용한 파일은 고치지 않는다 — 새 번호로 하나 더 만든다
//
// 적용 이력은 schema_migrations 표에 남는다. 이 표는 06 의 저장 항목이 아니라
// 마이그레이션 도구가 쓰는 장부다.
//
// 스키마 적용은 풀링을 거치지 않는 직접 연결을 쓴다 → DATABASE_URL_UNPOOLED

import { readdir, readFile } from 'node:fs/promises';

import { createRequire } from 'node:module';

import { strictSsl } from './strict-ssl.mjs';

const pg = createRequire(import.meta.url)('pg');

const migrationsDir = new URL('../db/migrations/', import.meta.url);
const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  console.error(
    '\n.env.local 에 DATABASE_URL_UNPOOLED 가 없습니다.\n' +
      'Neon 콘솔의 Connection string 에서 "Direct connection" 값을 넣어주세요.\n',
  );
  process.exit(1);
}

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: strictSsl(connectionString) });

try {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  let count = 0;
  console.log('');

  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`  건너뜀  ${filename}  (이미 적용됨)`);
      continue;
    }

    const sql = await readFile(new URL(filename, migrationsDir), 'utf8');
    if (/^\s*(BEGIN|COMMIT)\b/im.test(sql)) {
      throw new Error(
        `${filename} 안에 BEGIN · COMMIT 이 있습니다. ` +
          '한 파일이 곧 한 트랜잭션이라 파일 안에 적지 않습니다.',
      );
    }

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`\n  실패  ${filename} — 이 파일의 변경은 전부 되돌렸습니다.\n`);
      throw error;
    }

    console.log(`  적용   ${filename}`);
    count += 1;
  }

  console.log(
    count
      ? `\n마이그레이션 ${count}개를 적용했습니다. 확인: npm run db:check\n`
      : '\n적용할 새 마이그레이션이 없습니다.\n',
  );
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
