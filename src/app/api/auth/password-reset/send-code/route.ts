// F35 — 비밀번호 찾기: "인증코드 받기" (05 P22 · P12)
//
// POST { email }  →  { ok: true, minutes: 5 }
//
// **가입 여부를 응답으로 알려 주지 않는다.** 가입한 이메일이든 아니든 같은 응답이
// 나가고, 메일은 가입한 사람에게만 실제로 간다. 다르게 답하면 이 화면이
// "이 학교 이메일이 가입돼 있는지" 를 확인해 주는 도구가 된다.
//
// 05 P22 의 「가입한 학교 이메일로만 재설정할 수 있다」는 그대로 지켜진다 —
// 가입하지 않은 주소로는 코드가 아예 만들어지지 않아 다음 단계로 갈 수 없다.

import { sql } from '@/lib/db';
import { sendVerificationCode } from '@/lib/email';
import { toSchoolEmail } from '@/lib/school-email';
import { EXPIRY_MINUTES, issueCode } from '@/lib/verification';

export const runtime = 'nodejs';

const MINUTES = EXPIRY_MINUTES['비밀번호 재설정'];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const email = toSchoolEmail((body as { email?: unknown })?.email);
  if (!email) {
    return Response.json(
      { ok: false, message: '학교 이메일 형식(ac.kr)으로 입력해주세요.' },
      { status: 400 },
    );
  }

  const rows = await sql<{ password_hash: string | null; withdraw_requested_at: string | null }>`
    SELECT password_hash, withdraw_requested_at
      FROM users
     WHERE email = ${email}
     LIMIT 1
  `;

  const user = rows[0];

  // 보낼 수 없는 경우들 — 응답은 성공과 똑같이 나간다.
  //   · 가입하지 않은 이메일
  //   · 탈퇴 대기 중 (05 P24 — 복구 안내가 먼저다)
  //
  // 구글 가입자(password_hash 가 NULL)는 **보내지 않고 사실대로 알린다** (팀 확정).
  // 05 P11 대로 구글 가입자는 비밀번호가 없고, 만드는 자리는 설정 > 프로필 수정
  // (F20 · v2)이다. 여기서 코드를 보내 비밀번호를 만들게 하면 F20 을 우회해
  // 「구글 가입자는 비밀번호를 만들지 않는다」가 무너진다.
  //
  // 이 응답만 가입 여부를 드러낸다 — 의도한 것이다. PRD 6절이 로그인(F38)에서
  // 이미 "구글 계정으로 로그인해주세요" 로 돌려보내기로 정해 두었으므로,
  // 비밀번호 찾기에서만 숨기면 두 화면이 어긋난다.
  // 드러나는 것은 「구글로 가입했는가」 하나뿐이고, 미가입과 이메일 가입은
  // 여전히 같은 응답(ok:true)이라 구별되지 않는다.
  if (user && !user.withdraw_requested_at && !user.password_hash) {
    return Response.json(
      {
        ok: false,
        reason: 'google_only',
        message:
          '구글 간편로그인으로 가입한 계정이에요. 구글 계정으로 로그인해주세요.',
      },
      { status: 409 },
    );
  }

  const canSend = Boolean(user) && !user?.withdraw_requested_at;

  if (canSend) {
    const issued = await issueCode(email, '비밀번호 재설정');
    if (issued.ok) {
      try {
        await sendVerificationCode(email, '비밀번호 재설정', issued.code, issued.minutes);
      } catch (error) {
        console.error('재설정 메일 발송 실패', error);
        // 여기만은 사실대로 알린다 — 사용자가 기다려도 오지 않을 메일이다.
        // 05 P22 · P12 — 갈 곳은 문의하기가 아니라 관리자 전화다.
        return Response.json(
          {
            ok: false,
            message:
              '메일을 보내지 못했어요. 잠시 뒤 다시 시도하거나 관리자(031-740-7700)에게 연락주세요.',
          },
          { status: 502 },
        );
      }
    }
    // 쿨다운에 걸린 경우(issued.ok === false)도 성공처럼 답한다 —
    // 코드는 이미 나가 있고, 남은 시간을 알려 주면 가입 여부가 드러난다.
  }

  return Response.json({ ok: true, minutes: MINUTES });
}
