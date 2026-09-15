// 비밀번호 · 인증코드 해시 — 서버에서만 쓴다.
//
// 외부 패키지를 쓰지 않고 node:crypto 의 scrypt 를 쓴다. bcrypt 는 네이티브 빌드가
// 필요하고 bcryptjs 는 느린 순수 JS 라, 노드에 내장된 scrypt 가 배포가 가장 단순하다.
//
// 저장 형태는 `scrypt$N$r$p$<salt-b64>$<hash-b64>` 한 줄이다. 파라미터를 같이 적어
// 두면 나중에 비용을 올려도 옛 해시를 그대로 검증할 수 있다.
//
// 이 파일은 users.password_hash (06 「사용자」 · 05 P11) 와
// email_verifications.code_hash · ticket_hash (06 「이메일 인증코드」 · 05 P22) 둘 다에 쓴다.

import 'server-only';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// N=2^15 은 노드 기본 maxmem(32MB)을 넘기므로 maxmem 을 함께 올린다.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 32;

export async function hash(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, KEYLEN, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * 맞으면 true. 형식이 깨졌거나 틀리면 false — 던지지 않는다.
 * 비교는 timingSafeEqual 로 한다(맞은 글자 수가 시간으로 새지 않게).
 */
export async function verify(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const derived = await scrypt(plain, salt, expected.length, {
      N,
      r,
      p,
      maxmem: PARAMS.maxmem,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
