// F39 — 구글로 처음 들어온 사람의 가입 마무리 (05 P11)
//
// POST { name, gender, school, studentId, room, agreed }  →  { ok: true }
//
// 05 P11: 「구글 로그인은 가입 경로를 겸한다 — 처음 들어온 사람은 회원가입 화면의
// 구글 모드에서 성별 · 소속 · 학번 · 호실 · 약관 동의를 채워야 가입이 끝나고,
// 그 전까지는 사용자로 치지 않는다. 구글 가입자는 가입할 때 비밀번호를 만들지 않는다.」
//
// **이메일은 본문에서 받지 않는다.** 구글이 확인해 준 주소를 세션에서 읽는다 —
// 본문으로 받으면 남의 학교 이메일로 계정을 만들 수 있다.
// 인증코드도 받지 않는다 — 구글이 이미 메일 소유를 확인했다(signIn 콜백의
// email_verified 검사). 같은 것을 두 번 확인하지 않는다.

import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { isValidStudentId, toSchoolEmail } from '@/lib/school-email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();

  const email = toSchoolEmail(session?.user?.email);
  if (!email) {
    return Response.json(
      { ok: false, message: '구글 로그인을 다시 해주세요.' },
      { status: 401 },
    );
  }

  // 이미 가입이 끝난 사람은 여기로 오지 않는다 (05 P11 — 같은 아이디는 같은 계정).
  if (!session?.pendingSignup) {
    return Response.json(
      { ok: false, message: '이미 가입이 끝난 계정이에요.' },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  if (!isValidStudentId(b.studentId)) {
    return Response.json(
      { ok: false, field: 'studentId', message: '학번을 입력해주세요.' },
      { status: 400 },
    );
  }

  // 이름은 구글 프로필 이름을 기본값으로 쓰되, 화면에서 고칠 수 있게 본문을 우선한다.
  const name =
    (typeof b.name === 'string' && b.name.trim()) || (session.user.name ?? '').trim();
  const gender = typeof b.gender === 'string' ? b.gender.trim() : '';
  const school = typeof b.school === 'string' ? b.school.trim() : '';
  const room = typeof b.room === 'string' ? b.room.trim() : '';
  if (!name || !gender || !school || !room) {
    return Response.json(
      { ok: false, message: '빈 칸을 모두 채워주세요.' },
      { status: 400 },
    );
  }

  if (b.agreed !== true) {
    return Response.json(
      { ok: false, field: 'agreed', message: '필수 약관에 동의해주세요.' },
      { status: 400 },
    );
  }

  const studentId = (b.studentId as string).trim();

  try {
    // password_hash 는 넣지 않는다 — NULL 로 둔다 (05 P11 · 06 「사용자」).
    // 비밀번호는 나중에 설정 > 프로필 수정(F20 · v2)이나
    // 비밀번호 찾기(F35)에서 만든다.
    await sql`
      INSERT INTO users (name, email, signup_method, gender, school, student_id, room)
      VALUES (${name}, ${email}, '구글', ${gender}, ${school}, ${studentId}, ${room})
    `;
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? '');
    if (message.includes('users_student_id_key')) {
      return Response.json(
        { ok: false, field: 'studentId', message: '이미 등록된 학번이에요.' },
        { status: 409 },
      );
    }
    if (message.includes('users_email_key')) {
      // 같은 이메일로 이미 계정이 생겼다 — 가입이 끝난 것으로 본다 (05 P11).
      return Response.json({ ok: true });
    }
    console.error('구글 가입 마무리 실패', error);
    return Response.json(
      { ok: false, message: '가입에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 다음 요청의 jwt 콜백이 users 를 다시 읽어 pendingSignup 을 끈다.
  // 화면은 이 응답을 받은 뒤 세션을 갱신하고 홈으로 간다.
  return Response.json({ ok: true });
}
