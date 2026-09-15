// 관리자 세션 — 사생 세션과 **완전히 분리한다**.
//
// 06 「관리자 계정」 은 users 와 별개 표다(admin_accounts). 같은 쿠키를 쓰면
// 사생 세션이 관리자 권한을 얻거나 그 반대가 될 수 있어, 이름이 다른 쿠키를
// 따로 쓰고 Auth.js 를 거치지 않는다.
//
//   사생   authjs.session-token   (Auth.js · JWT)
//   관리자 washed-admin           (여기 · HMAC 서명)
//
// 프로토타입(관리자로그인.dc.html)의 `static ADMIN_ID = 'eulji-university-dorm'` ·
// `ADMIN_PW = 'eulji-seongnam'` 이 오는 자리다 (08 · 1번).

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { sql } from '@/lib/db';
import { verify } from '@/lib/hash';

const COOKIE = 'washed-admin';
/** 관리자 세션 유효 시간 — 사생보다 짧게 둔다 (콘솔은 기기 앞에서 잠깐 쓴다) */
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET 이 없습니다.');
  return s;
}

/** `adminId.만료시각.서명` — 서명은 앞 두 조각에 대한 HMAC */
function sign(adminId: string, expiresAt: number): string {
  const body = `${adminId}.${expiresAt}`;
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function unsign(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [adminId, expRaw, mac] = parts;

  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const expected = createHmac('sha256', secret())
    .update(`${adminId}.${expRaw}`)
    .digest('base64url');

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return adminId;
}

/**
 * 아이디 · 비밀번호를 확인하고 쿠키를 심는다.
 * 맞으면 true. 어느 쪽이 틀렸는지 구별해 알려주지 않는다.
 */
export async function adminSignIn(loginId: string, password: string): Promise<boolean> {
  const rows = await sql<{ admin_id: string; password_hash: string }>`
    SELECT admin_id, password_hash
      FROM admin_accounts
     WHERE login_id = ${loginId.trim()}
     LIMIT 1
  `;

  const row = rows[0];
  if (!row) return false;
  if (!(await verify(password, row.password_hash))) return false;

  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const jar = await cookies();
  jar.set(COOKIE, sign(row.admin_id, expiresAt), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

export async function adminSignOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** 쿠키를 보고 관리자인지 확인한다. 아니면 null. */
export async function getAdmin(): Promise<{ adminId: string; loginId: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const adminId = unsign(token);
  if (!adminId) return null;

  // 쿠키가 유효해도 계정이 지워졌을 수 있다 — 매번 확인한다
  const rows = await sql<{ admin_id: string; login_id: string }>`
    SELECT admin_id, login_id FROM admin_accounts WHERE admin_id = ${adminId} LIMIT 1
  `;
  const row = rows[0];
  return row ? { adminId: row.admin_id, loginId: row.login_id } : null;
}

/** 관리자 화면에서 부른다. 아니면 관리자 로그인으로 보낸다. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
