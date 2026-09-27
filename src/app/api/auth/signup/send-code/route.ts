// F14 — 회원가입에서 학교 이메일 입력 후 "인증하기" (05 P11 · 08 · 1번)
//
// POST { email }  →  { ok: true, minutes }
//
// **코드는 응답에 넣지 않는다.** 메일로만 나간다 (08 · 25번 줄).
//
// **가입 여부를 응답으로 알려 주지 않는다** (비밀번호 찾기 send-code 와 같은 원칙).
// 이미 가입한 이메일 · 탈퇴 대기 이메일이든 아니든 같은 응답(ok:true)이 나가고,
// 메일은 아직 가입하지 않은 주소에만 실제로 간다. 다르게 답하면 이 화면이
// "이 학교 이메일이 가입돼 있는지" 를 확인해 주는 도구가 된다.
//
// 05 P11(같은 아이디는 같은 계정) · P24(탈퇴 대기 중 재가입 불가)는 그대로 지켜진다 —
// 가입된 주소로는 코드가 아예 만들어지지 않아 인증 단계(verify-code)를 넘을 수 없다.

import { sql } from '@/lib/db';
import { resolveMailMode, sendVerificationCode } from '@/lib/email';
import { toSchoolEmail } from '@/lib/school-email';
import { EXPIRY_MINUTES, invalidateCode, issueCode, type IssueResult } from '@/lib/verification';

export const runtime = 'nodejs';

const MINUTES = EXPIRY_MINUTES['회원가입'];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, code: 'BAD_REQUEST', message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const email = toSchoolEmail((body as { email?: unknown })?.email);
  if (!email) {
    // 07 화면 문구 그대로
    return Response.json(
      { ok: false, code: 'EMAIL_INVALID', message: '학교 이메일 형식(ac.kr)으로 입력해주세요.' },
      { status: 400 },
    );
  }

  // 이미 가입한 이메일(탈퇴 대기 포함)이면 보내지 않는다 — 응답은 성공과 똑같이 나간다.
  const existing = await sql<{ user_id: string }>`
    SELECT user_id FROM users WHERE email = ${email} LIMIT 1
  `;
  const canSend = existing.length === 0;

  // issued 는 아래 devCode 판정에서도 쓰므로 블록 밖에서 선언한다.
  let issued: IssueResult | null = null;

  if (canSend) {
    issued = await issueCode(email, '회원가입');
    if (issued.ok) {
      try {
        await sendVerificationCode(email, '회원가입', issued.code, issued.minutes);
      } catch (error) {
        console.error('가입 인증 메일 발송 실패', error);
        // 닿지 못한 코드는 죽인다 — 이걸 살려 두면 60초 쿨다운만 먹고
        // 사용자는 오지 않을 메일을 기다리게 된다.
        await invalidateCode(issued.verificationId);
        // 여기만은 사실대로 알린다 — 사용자가 기다려도 오지 않을 메일이다.
        // P12 · P22 — 메일이 닿지 않을 때 사용자가 갈 곳은 관리자 전화다.
        return Response.json(
          {
            ok: false,
            message:
              '인증 메일을 보내지 못했어요. 잠시 뒤 다시 시도하거나 관리자(031-740-7700)에게 연락주세요.',
          },
          { status: 502 },
        );
      }
    }
    // 쿨다운에 걸린 경우(issued.ok === false)도 성공처럼 답한다 —
    // 가입된 주소는 쿨다운에 걸릴 일이 없으므로, 429 를 따로 내면 "두 번 눌러
    // 429 가 나오면 미가입" 으로 가입 여부가 드러난다. 코드는 이미 나가 있다.
  }

  // 개발 편의: 터미널을 보지 않아도 되게 코드를 함께 내려준다.
  //
  // 06 「이메일 인증코드」는 "어떤 응답으로도 화면에 내려보내지 않는다"(08 · 25줄)이므로
  // **두 자물쇠를 모두 지날 때만** 넣는다 — 운영 빌드가 아니고(NODE_ENV),
  // 메일을 실제로 보내지 않는 콘솔 모드일 때(resolveMailMode).
  const devCode =
    process.env.NODE_ENV !== 'production' &&
    resolveMailMode() === 'console' &&
    issued?.ok
      ? { devCode: issued.code }
      : {};

  return Response.json({ ok: true, minutes: MINUTES, ...devCode });
}
