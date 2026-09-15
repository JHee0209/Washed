// F15 — 가입 폼 제출 (05 P11 · 06 「사용자」)
//
// POST { email, ticket, password, name, gender, school, studentId, room, agreed }
//   →  { ok: true }
//
// 인증을 마친 사람만 통과한다 — 코드가 아니라 verify-code 가 준 **일회용 표**를 본다.
// 만드는 것은 이메일 가입자다(signup_method = '이메일'). 구글 가입은
// /api/auth/google/complete-signup 이 따로 만든다 (05 P11 — 구글 가입자는
// 비밀번호를 만들지 않는다).

import { sql } from '@/lib/db';
import { hash } from '@/lib/hash';
import { isValidPassword, isValidStudentId, toSchoolEmail } from '@/lib/school-email';
import { consumeTicket } from '@/lib/verification';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  const email = toSchoolEmail(b.email);
  const ticket = typeof b.ticket === 'string' ? b.ticket : '';
  if (!email || !ticket) {
    return Response.json(
      { ok: false, field: 'email', message: '이메일 인증을 완료해주세요.' },
      { status: 400 },
    );
  }

  // 05 P11 — 비밀번호 8자 이상
  if (!isValidPassword(b.password)) {
    return Response.json(
      { ok: false, field: 'password', message: '비밀번호는 8자 이상이어야 해요.' },
      { status: 400 },
    );
  }

  // 05 P11 — 학번은 필수 · 숫자만 · 12자리까지
  if (!isValidStudentId(b.studentId)) {
    return Response.json(
      { ok: false, field: 'studentId', message: '학번을 입력해주세요.' },
      { status: 400 },
    );
  }

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const gender = typeof b.gender === 'string' ? b.gender.trim() : '';
  const school = typeof b.school === 'string' ? b.school.trim() : '';
  const room = typeof b.room === 'string' ? b.room.trim() : '';
  if (!name || !gender || !school || !room) {
    return Response.json(
      { ok: false, message: '빈 칸을 모두 채워주세요.' },
      { status: 400 },
    );
  }

  // 05 P11 — 필수 약관은 끝까지 읽어야 동의할 수 있다.
  // "끝까지 읽었는지" 는 화면이 보증하고, 서버는 동의 여부만 확인한다.
  if (b.agreed !== true) {
    return Response.json(
      { ok: false, field: 'agreed', message: '필수 약관에 동의해주세요.' },
      { status: 400 },
    );
  }

  // 표를 쓴다. 여기서 실패하면 인증을 마치지 않았거나 이미 쓴 표다.
  if (!(await consumeTicket(email, '회원가입', ticket))) {
    return Response.json(
      { ok: false, field: 'email', message: '이메일 인증을 다시 해주세요.' },
      { status: 400 },
    );
  }

  const passwordHash = await hash(b.password);
  const studentId = (b.studentId as string).trim();

  try {
    await sql`
      INSERT INTO users (name, email, password_hash, signup_method,
                         gender, school, student_id, room)
      VALUES (${name}, ${email}, ${passwordHash}, '이메일',
              ${gender}, ${school}, ${studentId}, ${room})
    `;
  } catch (error) {
    // email · student_id 가 UNIQUE 다 (06 「사용자」 · 05 P16).
    // 인증과 제출 사이에 남이 먼저 쓴 경우가 여기로 온다.
    const message = String((error as { message?: string })?.message ?? '');
    if (message.includes('users_student_id_key')) {
      return Response.json(
        { ok: false, field: 'studentId', message: '이미 등록된 학번이에요.' },
        { status: 409 },
      );
    }
    if (message.includes('users_email_key')) {
      return Response.json(
        { ok: false, field: 'email', message: '이미 가입된 이메일이에요.' },
        { status: 409 },
      );
    }
    console.error('가입 실패', error);
    return Response.json(
      { ok: false, message: '가입에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
