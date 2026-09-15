// F14 — 회원가입에서 학교 이메일 입력 후 "인증하기" (05 P11 · 08 · 1번)
//
// POST { email }  →  { ok: true, minutes }
//
// **코드는 응답에 넣지 않는다.** 메일로만 나간다 (08 · 25번 줄).

import { sql } from '@/lib/db';
import { sendVerificationCode } from '@/lib/email';
import { toSchoolEmail } from '@/lib/school-email';
import { issueCode } from '@/lib/verification';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const email = toSchoolEmail((body as { email?: unknown })?.email);
  if (!email) {
    // 07 화면 문구 그대로
    return Response.json(
      { ok: false, message: '학교 이메일 형식(ac.kr)으로 입력해주세요.' },
      { status: 400 },
    );
  }

  // 이미 가입한 이메일이면 보내지 않는다 (05 P11 — 같은 아이디는 같은 계정이다).
  // 가입 화면이라 "이미 가입된 메일" 을 알려 주는 것이 사용자에게 도움이 되고,
  // 로그인 화면으로 보내는 것이 흐름표(07)와 맞다.
  const existing = await sql<{ withdraw_requested_at: string | null }>`
    SELECT withdraw_requested_at FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    // 05 P24 — 탈퇴 대기 14일 동안은 같은 학교 이메일로 새로 가입할 수 없다.
    const message = existing[0].withdraw_requested_at
      ? '탈퇴 처리 중인 계정이에요. 복구 기간에는 다시 가입할 수 없어요.'
      : '이미 가입된 이메일이에요. 로그인해주세요.';
    return Response.json({ ok: false, message }, { status: 409 });
  }

  const issued = await issueCode(email, '회원가입');
  if (!issued.ok) {
    return Response.json(
      {
        ok: false,
        message: `${issued.retryAfterSeconds}초 뒤에 다시 보낼 수 있어요.`,
        retryAfterSeconds: issued.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  try {
    await sendVerificationCode(email, '회원가입', issued.code, issued.minutes);
  } catch (error) {
    console.error('가입 인증 메일 발송 실패', error);
    // P12 · P22 — 메일이 닿지 않을 때 사용자가 갈 곳은 관리자 전화다
    return Response.json(
      {
        ok: false,
        message:
          '인증 메일을 보내지 못했어요. 잠시 뒤 다시 시도하거나 관리자(031-740-7700)에게 연락주세요.',
      },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, minutes: issued.minutes });
}
