// F21 — 문의 접수 (05 SP8 · Issue #86).
//
// 설정 > 문의하기 화면은 있었지만 「문의 보내기」가 아무 데도 보내지 않고 성공 화면으로
// 넘어가기만 했다 — 사용자가 쓴 내용이 그대로 버려져 관리자가 문의가 왔다는 사실조차
// 알 수 없었다. 그 자리가 여기다.
//
// POST application/json
//   content  문의 내용 (필수 · inquiry-rules.ts 가 판정한다)
// →  201 { ok: true, inquiryId }
//
// **문의한 사람을 본문에서 읽지 않는다.** 화면이 이름·이메일을 함께 보여 주지만 그것은
// 세션에서 내려간 표시용 값이고, 저장되는 user_id 는 세션(auth())의 것뿐이다 —
// 본문에 남의 user_id 를 실어 보내도 무시된다 (reports 라우트와 같은 원칙 · 08 · 1번).
//
// 답변은 여전히 이메일로 나간다(SP8) — 관리자가 콘솔에서 내용을 읽고 사람이 보낸다.
// 이 라우트는 「관리자가 읽을 수 있게 남기는」 데까지만 한다.

import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { sql } from '@/lib/db';
import { validateInquiryInput } from '@/lib/inquiry-rules';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // ── 1. 로그인
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  // 05 P24 — 탈퇴를 신청하면 즉시 이용이 정지된다. 사생이 **쓰는** 라우트의 공통 검사다.
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  // ── 2. 본문 읽기
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  // 꺼내는 칸은 content 하나뿐이다 — user_id 를 실어 보내도 여기서 읽지 않는다.
  const content = (body ?? {}) as Record<string, unknown>;

  // ── 3. 검증 — 화면이 쓰는 것과 **같은 함수**다
  const result = validateInquiryInput({ content: content.content });
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: result.status });
  }

  // ── 4. 저장
  let inquiryId: string;
  try {
    const rows = await sql<{ inquiry_id: string }>`
      INSERT INTO inquiries (user_id, content)
      VALUES (${userId}, ${result.value.content})
      RETURNING inquiry_id
    `;
    inquiryId = rows[0].inquiry_id;
  } catch (error) {
    // inquiries 의 CHECK 에 걸린 경우도 여기로 온다 — 위 검증과 DB 가 어긋났다는
    // 뜻이라 조용히 넘기지 않는다. 문의 **내용**은 로그에 남기지 않는다.
    console.error('문의 저장 실패', userId, error);
    return Response.json(
      { ok: false, message: '문의를 접수하지 못했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, inquiryId }, { status: 201 });
}
