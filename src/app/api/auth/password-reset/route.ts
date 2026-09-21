// F35 — 비밀번호 찾기 3단계: 새 비밀번호 저장 (05 P22)
//
// POST { email, ticket, password }  →  { ok: true }
//
// 코드가 아니라 verify-code 가 준 **일회용 표**를 본다.
// 새 비밀번호는 8자 이상이어야 한다 (05 P22).

import { sql } from '@/lib/db';
import { hash } from '@/lib/hash';
import { isValidPassword, toSchoolEmail } from '@/lib/school-email';
import { consumeTicket } from '@/lib/verification';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, code: 'BAD_REQUEST', message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  const email = toSchoolEmail(b.email);
  const ticket = typeof b.ticket === 'string' ? b.ticket : '';
  if (!email || !ticket) {
    return Response.json(
      { ok: false, code: 'VERIFY_AGAIN', message: '인증을 다시 해주세요.' },
      { status: 400 },
    );
  }

  if (!isValidPassword(b.password)) {
    return Response.json(
      { ok: false, field: 'password', code: 'PASSWORD_TOO_SHORT', message: '비밀번호는 8자 이상이어야 해요.' },
      { status: 400 },
    );
  }

  if (!(await consumeTicket(email, '비밀번호 재설정', ticket))) {
    return Response.json(
      { ok: false, code: 'VERIFY_AGAIN', message: '인증을 다시 해주세요.' },
      { status: 400 },
    );
  }

  const passwordHash = await hash(b.password);

  // 탈퇴 대기 중인 계정은 바꾸지 않는다 (05 P24).
  //
  // 구글 가입자(password_hash 가 NULL)도 바꾸지 않는다 — send-code 에서 이미
  // 막았으므로 여기까지 올 수 없지만, 표를 받은 뒤 계정이 바뀌는 경우를 대비해
  // 마지막에 한 번 더 본다. 비밀번호를 **처음 만드는** 자리는 설정 > 프로필 수정
  // (F20 · v2)이지 비밀번호 찾기가 아니다 (05 P11).
  const updated = await sql<{ user_id: string }>`
    UPDATE users
       SET password_hash = ${passwordHash}
     WHERE email = ${email}
       AND withdraw_requested_at IS NULL
       AND password_hash IS NOT NULL
     RETURNING user_id
  `;

  if (updated.length === 0) {
    return Response.json(
      {
        ok: false,
        message:
          '비밀번호를 바꿀 수 없는 계정이에요. 구글 계정으로 로그인하거나 관리자(031-740-7700)에게 연락주세요.',
      },
      { status: 409 },
    );
  }

  return Response.json({ ok: true });
}
