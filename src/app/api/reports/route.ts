// F11 — 신고 접수 (05 P9 · P15 · P23 · 08 · 7번).
//
// 08 · 2번의 `washed_reports` 가 오는 자리다. 설정 화면이 localStorage 에 쌓던
// 신고가 여기를 거쳐 reports 표로 들어간다.
//
// POST multipart/form-data
//   reason       화면 라벨 ('세탁물이 있어요' 등 · report-rules.ts 가 DB 사유로 옮긴다)
//   machineKind  '세탁기' | '건조기'   (기기 관련 세 사유만 · 05 P15)
//   machineNo    '1' ~ '8'             (기기 관련 세 사유만 · 05 P15)
//   etcContent   '기타' 의 내용
//   evidence     이미지 파일           ('세탁물이 있어요' 만 · 필수 · 05 P15)
// →  201 { ok: true, reportId }
//
// **신고자는 폼에서 읽지 않는다.** 08 · 1번의 `reporter: '병찬 · 302호'` 가 오는
// 자리인데, 클라이언트가 보낸 값을 쓰면 누구나 남의 이름으로 신고할 수 있다.
// 세션(auth())의 user.id 만이 reporter_user_id 가 된다.

import { randomUUID } from 'node:crypto';

import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { sql } from '@/lib/db';
import { evidenceDeleteAfter, evidenceUrl } from '@/lib/evidence-storage';
import { MAX_EVIDENCE_BYTES, validateReportInput } from '@/lib/report-rules';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // ── 1. 로그인 (08 · 1번)
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, code: 'LOGIN_REQUIRED', message: '로그인이 필요해요.' }, { status: 401 });
  }

  // 05 P24 — 탈퇴를 신청하면 즉시 이용이 정지된다. 화면만 막으면 이 라우트를 직접
  // 부르는 길이 남는다.
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  // ── 2. 폼 읽기
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, code: 'BAD_REQUEST', message: '잘못된 요청이에요.' }, { status: 400 });
  }

  const evidenceField = form.get('evidence');
  // 빈 파일 입력은 크기 0 짜리 File 로 들어온다 — 첨부하지 않은 것으로 본다.
  const file = evidenceField instanceof File && evidenceField.size > 0 ? evidenceField : null;

  // ── 3. 용량 (05 P15 의 조건은 아니지만 여기서 먼저 막는다)
  //
  // **읽기 전에 한 번 본다.** 아래에서 arrayBuffer() 로 통째로 메모리에 올리므로,
  // 한도를 넘는 파일을 다 읽고 나서 거절하면 그만큼을 헛되이 올리게 된다.
  // 다만 file.size 는 클라이언트가 말한 값이라 이것만 믿지 않고, 읽은 뒤
  // 실제 바이트 수로 **다시** 본다 (아래 5번).
  if (file && file.size > MAX_EVIDENCE_BYTES) {
    return Response.json(
      { ok: false, message: `사진은 ${MAX_EVIDENCE_BYTES / (1024 * 1024)}MB 까지 첨부할 수 있어요.` },
      { status: 413 },
    );
  }

  let bytes: Buffer | null = null;
  if (file) {
    bytes = Buffer.from(await file.arrayBuffer());
  }

  // ── 4. 검증 — 화면이 쓰는 것과 **같은 함수**다 (08 · 7번)
  //
  // 화면의 showEvidenceSlot · canSubmit 을 건너뛰고 이 API 를 직접 불러도
  // 「세탁물이 있어요」는 사진 없이 접수되지 않는다. 판정이 여기 한 곳에 있다.
  const result = validateReportInput({
    reasonLabel: form.get('reason'),
    machineKind: form.get('machineKind'),
    machineNo: form.get('machineNo'),
    etcContent: form.get('etcContent'),
    // ── 5. 크기는 **실제로 읽은 바이트 수**로 잰다. 형식도 파일이 말한 MIME 을
    //      validateReportInput 이 허용 목록과 대조한다.
    evidence: file && bytes ? { mime: file.type, byteSize: bytes.byteLength } : null,
  });

  if (!result.ok) {
    // 검증 결과의 code · params 를 그대로 흘려보낸다 — message 도 그대로 남는다 (Issue #13)
    return Response.json(
      { ok: false, code: result.code, params: result.params, message: result.message },
      { status: result.status },
    );
  }
  const report = result.value;

  // ── 6. 저장
  //
  // report_id 를 **서버가** 만든다. 그래야 사진 주소(evidence_photo_url)를 넣기
  // 전에 id 를 알 수 있고, 주소가 클라이언트 입력이 아니라 서버 조립물이 된다.
  const reportId = randomUUID();
  const photoUrl = report.evidence ? evidenceUrl(reportId) : null;

  try {
    if (report.evidence && bytes) {
      // 신고와 사진을 **한 문장**으로 넣는다 = 한 트랜잭션이다.
      // 나눠 보내면 앞이 성공하고 뒤가 실패했을 때 ①사진을 가리키지만 파일이 없는
      // 신고나 ②주인 없는 파일(orphan)이 남는다. 한 문장이면 둘 다 불가능하다.
      // (admin-actions.ts 의 addNotice 가 같은 이유로 쓰는 방식이다.)
      await sql`
        WITH new_report AS (
          INSERT INTO reports (
            report_id, reporter_user_id, reason, machine_kind, machine_no,
            evidence_photo_url, etc_content
          )
          VALUES (
            ${reportId}, ${userId}, ${report.reason}, ${report.machineKind}, ${report.machineNo},
            ${photoUrl}, ${report.etcContent}
          )
          RETURNING report_id
        )
        INSERT INTO report_evidence (report_id, mime_type, byte_size, bytes, delete_after)
        SELECT n.report_id,
               ${report.evidence.mime},
               ${bytes.byteLength},
               decode(${bytes.toString('base64')}, 'base64'),
               -- 드라이버는 값을 문자열로 보낸다 — 캐스트를 적어 두면 어느 쪽이
               -- 타입을 추론하든 같은 결과가 된다.
               ${evidenceDeleteAfter().toISOString()}::timestamptz
          FROM new_report n
      `;
    } else {
      await sql`
        INSERT INTO reports (
          report_id, reporter_user_id, reason, machine_kind, machine_no,
          evidence_photo_url, etc_content
        )
        VALUES (
          ${reportId}, ${userId}, ${report.reason}, ${report.machineKind}, ${report.machineNo},
          NULL, ${report.etcContent}
        )
      `;
    }
  } catch (error) {
    // reports 의 CHECK 제약(05 P15)에 걸린 경우도 여기로 온다 — 위 검증과 DB 가
    // 어긋났다는 뜻이라 조용히 넘기지 않는다.
    console.error('신고 저장 실패', userId, error);
    return Response.json(
      { ok: false, code: 'REPORT_FAILED', message: '신고를 접수하지 못했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 05 P9 — 새 신고의 상태는 '접수됨' 이다 (reports.status 의 기본값).
  // 관리자 콘솔의 신고 탭이 바로 보게 한다.
  return Response.json({ ok: true, reportId }, { status: 201 });
}
