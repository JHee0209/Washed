// F14 — 회원가입 인증번호 6자리 확인 (05 P11)
//
// POST { email, code }  →  { ok: true, ticket }
//
// 맞으면 일회용 표를 돌려준다. 가입 폼 제출(F15)이 이 표를 들고 온다.
// 화면 문구는 회원가입.dc.html 의 codeMessage 를 그대로 쓴다.

import { toSchoolEmail } from '@/lib/school-email';
import { verifyCode } from '@/lib/verification';

export const runtime = 'nodejs';

const MESSAGES = {
  none: '인증번호를 다시 받아주세요.',
  expired: '인증 시간이 만료됐어요. 재발송해주세요.',
  wrong: '인증번호가 일치하지 않아요.',
  too_many: '여러 번 틀렸어요. 인증번호를 다시 받아주세요.',
} as const;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const { email: rawEmail, code: rawCode } = (body ?? {}) as {
    email?: unknown;
    code?: unknown;
  };

  const email = toSchoolEmail(rawEmail);
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';

  if (!email || !/^[0-9]{6}$/.test(code)) {
    return Response.json({ ok: false, message: MESSAGES.wrong }, { status: 400 });
  }

  const result = await verifyCode(email, '회원가입', code);
  if (!result.ok) {
    return Response.json(
      { ok: false, reason: result.reason, message: MESSAGES[result.reason] },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, ticket: result.ticket });
}
