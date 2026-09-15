// F35 — 비밀번호 찾기 2단계: 인증코드 6자리 확인 (05 P22)
//
// POST { email, code }  →  { ok: true, ticket }
//
// 화면 문구는 비밀번호찾기.dc.html 의 codeErrorText 를 그대로 쓴다.

import { toSchoolEmail } from '@/lib/school-email';
import { verifyCode } from '@/lib/verification';

export const runtime = 'nodejs';

const MESSAGES = {
  none: '인증코드를 다시 받아주세요.',
  expired: '인증 시간이 지났어요. 다시 보내기를 눌러주세요.',
  wrong: '인증코드가 올바르지 않아요.',
  too_many: '여러 번 틀렸어요. 인증코드를 다시 받아주세요.',
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

  const result = await verifyCode(email, '비밀번호 재설정', code);
  if (!result.ok) {
    return Response.json(
      { ok: false, reason: result.reason, message: MESSAGES[result.reason] },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, ticket: result.ticket });
}
