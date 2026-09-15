// 이메일 인증코드 — 발급 · 검증 · 사용 (F14 가입 인증 · F35 비밀번호 재설정)
//
// 06 「이메일 인증코드」 · 05 P11 · P22 · 08 · 1번(25번 줄)
//
// 지켜야 하는 것 넷
//   1. 코드는 서버가 만들고 서버만 안다 — 어떤 응답에도 넣지 않는다.
//   2. 저장은 해시로 한다 — DB 가 새어도 코드가 그대로 나가지 않는다.
//   3. 유효 시간 안에만 맞는다 — 재설정 5분(P22) · 가입 3분(프로토타입 값 · [?]).
//   4. 틀린 횟수를 세고 5회를 넘기면 그 코드를 죽인다.
//
// 인증을 마치면 **일회용 표**(ticket)를 발급해 화면에 준다. 가입 폼 제출(F15)과
// 새 비밀번호 저장(F35)은 코드가 아니라 이 표를 들고 오고, 한 번 쓰면 죽는다.
// 표가 코드와 다른 점: 표는 서버가 이미 "이 이메일은 인증됐다" 고 판정한 결과물이라
// 밖으로 내보내도 되고, 길어서(32바이트) 찍어 맞힐 수 없다.

import 'server-only';
import { randomBytes, randomInt } from 'node:crypto';

import { sql } from '@/lib/db';
import { hash, verify } from '@/lib/hash';

export type Purpose = '회원가입' | '비밀번호 재설정';

/** 유효 시간(분). 재설정 5분은 05 P22 에 있는 값이다. */
export const EXPIRY_MINUTES: Record<Purpose, number> = {
  // [?] 가입 3분은 프로토타입(회원가입.dc.html)의 값이고 05 에는 아직 없다 — 팀 확인 필요
  회원가입: 3,
  '비밀번호 재설정': 5,
};

/** 틀릴 수 있는 횟수. 넘기면 코드가 죽고 다시 받아야 한다. */
const MAX_ATTEMPTS = 5;

/** 재발송 쿨다운(초). 같은 이메일로 연달아 보내는 것을 막는다. */
const RESEND_COOLDOWN_SECONDS = 60;

type Row = {
  verification_id: string;
  code_hash: string;
  expires_at: string;
  attempt_count: number;
  verified_at: string | null;
  ticket_hash: string | null;
  consumed_at: string | null;
};

/** 6자리. randomInt 는 암호학적 난수라 Math.random 을 쓰지 않는다. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export type IssueResult =
  | { ok: true; code: string; minutes: number }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number };

/**
 * 코드를 새로 만들어 저장한다. 반환된 code 는 **메일로만** 나가야 한다 —
 * 라우트가 이것을 응답 본문에 넣으면 08 · 1번을 어기는 것이다.
 *
 * 이전 코드는 지우지 않는다. 검증이 항상 「가장 최근 한 줄」만 보므로 자동으로 죽는다.
 */
export async function issueCode(email: string, purpose: Purpose): Promise<IssueResult> {
  const recent = await sql<{ seconds_ago: number }>`
    SELECT EXTRACT(EPOCH FROM (now() - created_at))::int AS seconds_ago
      FROM email_verifications
     WHERE email = ${email} AND purpose = ${purpose}
     ORDER BY created_at DESC
     LIMIT 1
  `;

  const secondsAgo = recent[0]?.seconds_ago;
  if (typeof secondsAgo === 'number' && secondsAgo < RESEND_COOLDOWN_SECONDS) {
    return {
      ok: false,
      reason: 'cooldown',
      retryAfterSeconds: RESEND_COOLDOWN_SECONDS - secondsAgo,
    };
  }

  const minutes = EXPIRY_MINUTES[purpose];
  const code = generateCode();
  const codeHash = await hash(code);

  await sql`
    INSERT INTO email_verifications (email, purpose, code_hash, expires_at)
    VALUES (
      ${email},
      ${purpose},
      ${codeHash},
      now() + make_interval(mins => ${minutes}::int)
    )
  `;

  return { ok: true, code, minutes };
}

export type VerifyResult =
  | { ok: true; ticket: string }
  | { ok: false; reason: 'none' | 'expired' | 'wrong' | 'too_many' };

/**
 * 코드를 맞춰 보고, 맞으면 일회용 표를 발급한다.
 *
 * 「가장 최근 한 줄」만 본다 — 재발송했으면 이전 코드는 이미 죽은 것이다.
 * 이미 인증을 마친 줄이면 표를 다시 만들어 주지 않고 새로 받게 한다(재사용 방지).
 */
export async function verifyCode(
  email: string,
  purpose: Purpose,
  code: string,
): Promise<VerifyResult> {
  const rows = await sql<Row>`
    SELECT verification_id, code_hash, expires_at, attempt_count,
           verified_at, ticket_hash, consumed_at
      FROM email_verifications
     WHERE email = ${email} AND purpose = ${purpose}
     ORDER BY created_at DESC
     LIMIT 1
  `;

  const row = rows[0];
  if (!row || row.verified_at) return { ok: false, reason: 'none' };
  if (row.attempt_count >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many' };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const matched = await verify(code, row.code_hash);
  if (!matched) {
    const bumped = await sql<{ attempt_count: number }>`
      UPDATE email_verifications
         SET attempt_count = attempt_count + 1
       WHERE verification_id = ${row.verification_id}
       RETURNING attempt_count
    `;
    const count = bumped[0]?.attempt_count ?? row.attempt_count + 1;
    return { ok: false, reason: count >= MAX_ATTEMPTS ? 'too_many' : 'wrong' };
  }

  const ticket = randomBytes(32).toString('base64url');
  const ticketHash = await hash(ticket);

  // verified_at 이 아직 비어 있을 때만 찍는다 — 같은 코드로 두 번 들어와도
  // 표는 한 번만 나간다.
  const updated = await sql<{ verification_id: string }>`
    UPDATE email_verifications
       SET verified_at = now(), ticket_hash = ${ticketHash}
     WHERE verification_id = ${row.verification_id}
       AND verified_at IS NULL
     RETURNING verification_id
  `;
  if (updated.length === 0) return { ok: false, reason: 'none' };

  return { ok: true, ticket };
}

/**
 * 표를 쓴다. 맞으면 true 를 돌려주고 그 표는 죽는다.
 *
 * 가입 폼 제출(F15)과 새 비밀번호 저장(F35)이 마지막에 부르는 자리다.
 * 표를 쓰기 전에 만료를 한 번 더 본다 — 인증만 해 두고 한참 뒤에 제출하는 것을 막는다.
 */
export async function consumeTicket(
  email: string,
  purpose: Purpose,
  ticket: string,
): Promise<boolean> {
  const rows = await sql<Row>`
    SELECT verification_id, code_hash, expires_at, attempt_count,
           verified_at, ticket_hash, consumed_at
      FROM email_verifications
     WHERE email = ${email} AND purpose = ${purpose}
     ORDER BY created_at DESC
     LIMIT 1
  `;

  const row = rows[0];
  if (!row || !row.verified_at || !row.ticket_hash || row.consumed_at) return false;

  // 인증을 마친 뒤 표를 쓸 수 있는 시간. 코드 유효 시간과 별개로 10분을 준다 —
  // 가입 폼(성별 · 소속 · 학번 · 호실 · 약관)을 채우는 데 3분은 너무 짧다.
  const verifiedAt = new Date(row.verified_at).getTime();
  if (Date.now() - verifiedAt > 10 * 60 * 1000) return false;

  if (!(await verify(ticket, row.ticket_hash))) return false;

  const consumed = await sql<{ verification_id: string }>`
    UPDATE email_verifications
       SET consumed_at = now()
     WHERE verification_id = ${row.verification_id}
       AND consumed_at IS NULL
     RETURNING verification_id
  `;
  return consumed.length > 0;
}
