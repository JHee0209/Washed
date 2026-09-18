// db/migrations/ 의 파일과 DB 장부(schema_migrations)를 견줘 무엇이 밀렸는지만 본다.
// 실행: npm run db:migrate:status                                        (Issue #59)
//
// **읽기 전용이다. 아무것도 바꾸지 않는다.** 보내는 것은 SELECT 두 개뿐이고
// INSERT · UPDATE · DELETE · CREATE · ALTER · DROP · BEGIN 이 이 파일에 없다.
// db:migrate 는 장부 표가 없으면 만들어 두지만 **이 스크립트는 만들지 않는다** —
// 그것도 DB 를 바꾸는 일이라, 표가 있는지만 to_regclass 로 물어본다.
//
// 적용은 사람이 한다. 특히 Production 에 대고 db:migrate 를 자동으로 거는 절차를
// 만들지 않는다 — 환경별 확인 절차는 docs/08-deployNOTE.md 13번에 있다.
//
// 평소 조회와 같은 풀링 연결(DATABASE_URL)을 쓴다. db-check.mjs 와 같은 쪽이다.
// 풀링 주소만 없는 환경을 위해 DATABASE_URL_UNPOOLED 로 물러선다 — 같은 DB 다.

import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import pg from 'pg';

import { strictSsl } from './strict-ssl.mjs';
import { EXIT, compareMigrations, exitCodeFor, formatReport } from './migration-status.mjs';

const migrationsDir = new URL('../db/migrations/', import.meta.url);

const source = process.env.DATABASE_URL
  ? 'DATABASE_URL'
  : process.env.DATABASE_URL_UNPOOLED
    ? 'DATABASE_URL_UNPOOLED'
    : null;

if (!source) {
  console.error('\n.env.local 에 DATABASE_URL 이 없습니다.\n');
  process.exit(EXIT.FAILED);
}

const connectionString = process.env[source];

// 어느 DB 를 보고 있는지 나타내되 **접속 문자열을 드러내지 않는다**.
// host 와 DB 이름을 해시한 앞 8자리만 쓴다 — 되돌릴 수 없고, 같은 DB 면 늘 같은 값이라
// 개발 · Preview · Production 이 같은 곳을 보고 있는지 눈으로 대조할 수 있다.
function safeLabel(urlText, varName) {
  try {
    const url = new URL(urlText);
    const database = url.pathname.replace(/^\//, '') || '(이름 없음)';
    const fingerprint = createHash('sha256')
      .update(`${url.host}/${database}`)
      .digest('hex')
      .slice(0, 8);
    return `${varName} · DB ${database} · 지문 ${fingerprint}`;
  } catch {
    // 파싱에 실패해도 원문을 찍지 않는다.
    return `${varName} · 주소 형식을 읽지 못했습니다`;
  }
}

const envLabel = safeLabel(connectionString, source);

// 드라이버가 주는 오류 문구에는 host 가 그대로 끼어 있다 (예: getaddrinfo ENOTFOUND <host>).
// 그대로 찍으면 접속 정보가 출력에 남으므로, 접속 문자열에서 뽑은 조각을 지우고 내보낸다.
function redact(message) {
  let out = String(message ?? '');
  try {
    const url = new URL(connectionString);
    for (const secret of [url.password, url.username, url.hostname, url.host]) {
      if (secret) out = out.split(secret).join('…');
    }
  } catch {
    // 주소를 못 읽으면 지울 조각도 모른다 — 아래에서 통째로 막는다.
    return '(오류 문구를 그대로 보여주지 않습니다 — 접속 주소가 낄 수 있습니다)';
  }
  return out;
}

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: strictSsl(connectionString) });

try {
  await client.connect();
} catch (error) {
  console.error(`\nDB 에 연결하지 못했습니다 — ${envLabel}\n`);
  console.error(`  ${redact(error.message)}\n`);
  process.exit(EXIT.FAILED);
}

try {
  const { rows: found } = await client.query(
    "SELECT to_regclass('public.schema_migrations') AS ledger",
  );
  const ledgerMissing = !found[0].ledger;

  const appliedAt = new Map();
  let appliedFilenames = [];

  if (!ledgerMissing) {
    const { rows } = await client.query(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename',
    );
    appliedFilenames = rows.map((r) => r.filename);
    for (const row of rows) {
      appliedAt.set(row.filename, row.applied_at.toISOString().slice(0, 10));
    }
  }

  const result = compareMigrations(files, appliedFilenames);
  console.log(formatReport(result, { envLabel, appliedAt, ledgerMissing }).join('\n'));

  await client.end();
  process.exit(exitCodeFor(result));
} catch (error) {
  console.error(`\nschema_migrations 를 읽지 못했습니다 — ${envLabel}\n`);
  console.error(`  ${redact(error.message)}\n`);
  await client.end();
  process.exit(EXIT.LEDGER_ERROR);
}
