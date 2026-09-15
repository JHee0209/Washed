// 관리자 계정을 만든다 (06 「관리자 계정」 · F30).
//
//   node --env-file=.env.local scripts/admin-create.mjs <아이디> <비밀번호>
//
// 화면에서 만들 수 없게 두었다 — 관리자 계정을 화면에서 만들 수 있으면
// 그 화면 자체가 권한 상승 통로가 된다. 시스템 담당자가 터미널에서만 만든다.
//
// 비밀번호는 src/lib/hash.ts 와 같은 방식(scrypt)으로 해시한다.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

const scrypt = promisify(scryptCb);
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

async function hash(plain) {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 32, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p,
          salt.toString('base64'), derived.toString('base64')].join('$');
}

const [loginId, password] = process.argv.slice(2);

if (!loginId || !password) {
  console.error('사용법: node --env-file=.env.local scripts/admin-create.mjs <아이디> <비밀번호>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('비밀번호는 8자 이상이어야 합니다.');
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL 이 없습니다.');
  process.exit(1);
}

const sql = neon(url);
const passwordHash = await hash(password);

try {
  const existing = await sql`SELECT admin_id FROM admin_accounts WHERE login_id = ${loginId}`;
  if (existing.length > 0) {
    await sql`UPDATE admin_accounts SET password_hash = ${passwordHash} WHERE login_id = ${loginId}`;
    console.log(`이미 있는 계정이라 비밀번호만 바꿨습니다 — ${loginId}`);
  } else {
    await sql`INSERT INTO admin_accounts (login_id, password_hash) VALUES (${loginId}, ${passwordHash})`;
    console.log(`관리자 계정을 만들었습니다 — ${loginId}`);
  }
  console.log('로그인: /admin/login');
} catch (e) {
  console.error('실패:', e.message);
  process.exit(1);
}
