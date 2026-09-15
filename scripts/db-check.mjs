// 적용된 스키마를 눈으로 확인한다.  실행: npm run db:check
// 아무것도 바꾸지 않고 읽기만 한다. 평소 쿼리와 같은 풀링 연결(DATABASE_URL)을 쓴다.

import pg from 'pg';

import { strictSsl } from './strict-ssl.mjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('\n.env.local 에 DATABASE_URL 이 없습니다.\n');
  process.exit(1);
}

// 06-data.md 의 저장 항목 순서. 저장 항목 13개 중 「언어 설정」은 기기 단위라
// 표가 없다 (06 마지막 문단 · 05 P25) → 12개.
const EXPECTED = [
  ['users', '사용자'],
  ['machines', '기기'],
  ['queue', '줄서기'],
  ['warnings', '경고'],
  ['usage_restrictions', '이용 제한'],
  ['reports', '신고'],
  ['notifications', '알림'],
  ['push_subscriptions', '푸시 구독'],
  ['usage_history', '이용 내역'],
  ['admin_accounts', '관리자 계정'],
  ['notices', '공지'],
  ['email_verifications', '이메일 인증코드'],
];

// 06 의 저장 항목은 아니지만 있어야 하는 표 — 마이그레이션 도구의 장부
const INFRA = ['schema_migrations'];

const client = new pg.Client({ connectionString: strictSsl(connectionString) });

try {
  await client.connect();

  const { rows } = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position
  `);

  const byTable = new Map();
  for (const row of rows) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, []);
    byTable.get(row.table_name).push(row);
  }

  let missing = 0;
  for (const [table, label] of EXPECTED) {
    const columns = byTable.get(table);
    if (!columns) {
      console.log(`\n[없음] ${table} (06 「${label}」)`);
      missing += 1;
      continue;
    }
    console.log(`\n${table}  — 06 「${label}」`);
    for (const c of columns) {
      const nullable = c.is_nullable === 'YES' ? 'NULL 허용' : 'NOT NULL';
      const def = c.column_default ? ` · 기본값 ${c.column_default}` : '';
      console.log(`  · ${c.column_name.padEnd(22)} ${c.data_type.padEnd(26)} ${nullable}${def}`);
    }
  }

  const extra = [...byTable.keys()].filter(
    (t) => !EXPECTED.some(([name]) => name === t) && !INFRA.includes(t),
  );
  if (extra.length) console.log(`\n06 에 없는 표: ${extra.join(', ')}`);

  console.log(
    `\n06 기준 ${EXPECTED.length}개 중 ${EXPECTED.length - missing}개 확인${missing ? ` · 없음 ${missing}개` : ''}.\n`,
  );
  if (missing) process.exit(1);
} catch (error) {
  console.error('\n확인에 실패했습니다.\n');
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
