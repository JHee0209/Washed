// F11 — 증거 사진 내려주기 (05 P15 · P23 · SP9).
//
// reports.evidence_photo_url 이 가리키는 주소다. 파일은 report_evidence(0005)에 있다.
//
// **private 이다.** 사진에는 남의 세탁물이 찍히므로 주소만 알면 보이는 곳에 둘 수
// 없다. 통과하는 사람은 둘뿐이다:
//   · 그 신고를 쓴 본인 (사생 세션 · Auth.js)
//   · 관리자            (관리자 세션 · washed-admin 쿠키 · SP9)
// 두 세션은 서로 완전히 분리되어 있다 (src/lib/admin-session.ts 머리말).
//
// **읽기만 있다.** PUT · DELETE 를 두지 않는 것은 남의 사진을 덮어쓰거나 지우는
// 표면 자체를 만들지 않기 위해서다. 사진이 사라지는 길은 보관 기간 배치(05 P23)와
// 신고자 탈퇴(05 P24) 둘뿐이고 둘 다 서버 안에서만 일어난다.

import { auth } from '@/auth';
import { getAdmin } from '@/lib/admin-session';
import { sql } from '@/lib/db';
import { readEvidence } from '@/lib/evidence-storage';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // 신고가 있는지, 누구 것인지 먼저 본다.
  const rows = await sql<{ reporter_user_id: string }>`
    SELECT reporter_user_id FROM reports WHERE report_id = ${id} LIMIT 1
  `;
  const report = rows[0];
  if (!report) {
    return Response.json({ ok: false, message: '신고를 찾을 수 없어요.' }, { status: 404 });
  }

  // 관리자 → 통과. 아니면 신고자 본인인지 본다.
  const admin = await getAdmin();
  if (!admin) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
    }
    if (userId !== report.reporter_user_id) {
      // 신고가 있는지 없는지를 드러내지 않으려면 404 가 낫지만, 여기서는 이미
      // 로그인한 사람이고 주소는 report_id 를 알아야 만들 수 있다. 403 으로 분명히 한다.
      return Response.json({ ok: false, message: '볼 수 있는 권한이 없어요.' }, { status: 403 });
    }
  }

  const evidence = await readEvidence(id);
  if (!evidence) {
    // 05 P23 — 올린 지 3개월이 지나 배치가 지웠다. 신고 기록은 남아 있고 사진만 없다.
    // 없어진 적이 없는 404 와 가른다 — 화면이 "보관 기간이 지났어요" 를 띄울 수 있다.
    return Response.json({ ok: false, message: '보관 기간이 지나 사진이 삭제됐어요.' }, { status: 410 });
  }

  return new Response(new Uint8Array(evidence.bytes), {
    headers: {
      'Content-Type': evidence.mimeType,
      'Content-Length': String(evidence.byteSize),
      // 권한을 보고 내려주는 응답이다. 공용 캐시에 남으면 그 검사가 무의미해진다.
      'Cache-Control': 'private, no-store',
      // 브라우저가 내용을 보고 다른 형식으로 해석하지 않게 한다.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
