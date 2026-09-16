// 신고 증거 사진의 **저장소 층** (F11 · 05 P15 · P23 · 08 · 7번).
//
// 바깥(라우트 · 배치)은 이 파일의 함수만 부른다. 지금은 Neon Postgres 안의
// report_evidence 표(0005)가 저장소지만, 나중에 S3 로 옮길 때 **고칠 곳은 여기
// 하나다** — 라우트도 배치도 손대지 않는다.
//
// ── 바이트를 base64 로 주고받는 이유
// @neondatabase/serverless 의 HTTP 함수는 값을 JSON 으로 실어 보낸다. Buffer 를
// 그대로 넘기면 드라이버·런타임에 따라 직렬화가 달라진다. base64 문자열로 넘기고
// SQL 쪽에서 decode(..., 'base64') 하면 어디서 돌든 같은 바이트가 들어간다.
// 읽을 때도 encode(bytes, 'base64') 로 문자열을 받는다.

import 'server-only';

import { sql } from '@/lib/db';
import { EVIDENCE_RETENTION_MONTHS, type EvidenceMime } from '@/lib/report-rules';

/**
 * 05 P23 — 이 신고의 사진을 언제까지 두는가.
 *
 * 값을 계산해 **행에 박아 둔다.** 보관 기간을 나중에 바꿔도 이미 올라온 사진은
 * 올릴 때 약속한 시점에 지워진다.
 */
export function evidenceDeleteAfter(uploadedAt: Date = new Date()): Date {
  const at = new Date(uploadedAt);
  at.setMonth(at.getMonth() + EVIDENCE_RETENTION_MONTHS);
  return at;
}

/**
 * 신고가 가리킬 사진 주소 (reports.evidence_photo_url).
 *
 * **서버가 조립한다.** 클라이언트가 보낸 문자열을 그대로 넣으면 임의의 경로를
 * 신고에 붙일 수 있다 — report_id 는 서버가 만든 UUID 이므로 여기서 나오는
 * 주소도 서버가 정한 것뿐이다.
 */
export function evidenceUrl(reportId: string): string {
  return `/api/reports/${reportId}/evidence`;
}

export type StoredEvidence = {
  mimeType: EvidenceMime;
  byteSize: number;
  bytes: Buffer;
};

/**
 * 사진 한 장을 읽는다. 신고에 사진이 없거나 보관 기간이 지나 지워졌으면 null.
 *
 * **권한은 여기서 보지 않는다** — 부르는 쪽(/api/reports/[id]/evidence)이 신고자
 * 본인인지 관리자인지를 먼저 가린다. 저장소 층은 저장과 삭제만 안다.
 */
export async function readEvidence(reportId: string): Promise<StoredEvidence | null> {
  const rows = await sql<{ mime_type: EvidenceMime; byte_size: number; b64: string }>`
    SELECT mime_type, byte_size, encode(bytes, 'base64') AS b64
      FROM report_evidence
     WHERE report_id = ${reportId}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    bytes: Buffer.from(row.b64, 'base64'),
  };
}

/**
 * 05 P23 — 보관 기간이 지난 사진을 지운다. 지운 장수를 돌려준다.
 *
 * **신고 기록(reports)은 지우지 않는다.** 사진만 사라지고 신고는 남는다
 * (db/migrations/0005 아래쪽 주석 · P23 「목록에서 사진이 사라짐」).
 */
export async function deleteExpiredEvidence(now: Date = new Date()): Promise<number> {
  const rows = await sql<{ report_id: string }>`
    DELETE FROM report_evidence
     WHERE delete_after <= ${now.toISOString()}::timestamptz
    RETURNING report_id
  `;
  return rows.length;
}

/**
 * 05 P23 — 한 사람이 올린 증거 사진을 전부 지운다. 지운 장수를 돌려준다.
 *
 * 지금 저장소에서는 users → reports → report_evidence 가 모두 ON DELETE CASCADE 라
 * 사용자를 지우기만 해도 파일이 함께 사라진다. 그래도 **명시적으로 부른다** —
 * 외부 저장소(S3 등)로 옮기면 DB 행이 CASCADE 로 사라져도 파일은 남기 때문에,
 * 「사용자를 지우기 전에 파일부터 지운다」는 순서가 그때 유일하게 맞는 순서다.
 * 저장소를 갈아 끼울 때 부르는 쪽을 고치지 않아도 되도록 지금부터 이 순서로 둔다.
 */
export async function deleteEvidenceForUser(userId: string): Promise<number> {
  const rows = await sql<{ report_id: string }>`
    DELETE FROM report_evidence
     WHERE report_id IN (SELECT report_id FROM reports WHERE reporter_user_id = ${userId})
    RETURNING report_id
  `;
  return rows.length;
}

/**
 * 05 P24 — 유예가 끝난 **모든** 탈퇴 계정의 사진을 한 문장으로 지운다.
 *
 * deleteEvidenceForUser() 를 사람 수만큼 도는 것과 결과는 같지만, 배치는 한 번에
 * 여러 명을 처리하므로 왕복을 한 번으로 줄인다(작업 지시 14번 「set-based」).
 * 계정을 지우기 **전에** 부르는 순서는 그대로다 — 이유는 위 함수의 주석에 있다.
 */
export async function deleteEvidenceForWithdrawnUsers(cutoff: Date): Promise<number> {
  const rows = await sql<{ report_id: string }>`
    DELETE FROM report_evidence
     WHERE report_id IN (
             SELECT r.report_id
               FROM reports r
               JOIN users u ON u.user_id = r.reporter_user_id
              WHERE u.withdraw_requested_at IS NOT NULL
                AND u.withdraw_requested_at <= ${cutoff.toISOString()}::timestamptz
           )
    RETURNING report_id
  `;
  return rows.length;
}

/**
 * 05 P23 · SP4 — 보관 기간이 지난 **신고에 딸린** 사진을 지운다.
 *
 * 신고 자체를 지우기 직전에 부른다. report_evidence 는 reports 의 ON DELETE CASCADE
 * 라 지금 저장소에서는 부르지 않아도 사라지지만, 외부 저장소로 옮기면 DB 행만
 * 사라지고 파일이 남는다 — 그때 맞는 순서를 지금부터 둔다(deleteEvidenceForUser 와
 * 같은 이유다).
 *
 * 올린 지 3개월이 지난 사진은 이미 deleteExpiredEvidence() 가 delete_after 로 지웠을
 * 것이다. 그래도 기산점이 다르므로(사진은 **올린** 시각, 신고는 **접수** 시각) 남아
 * 있는 것이 있을 수 있어 한 번 더 훑는다.
 */
export async function deleteEvidenceForExpiredReports(cutoff: Date): Promise<number> {
  const rows = await sql<{ report_id: string }>`
    DELETE FROM report_evidence
     WHERE report_id IN (
             SELECT report_id
               FROM reports
              WHERE created_at <= ${cutoff.toISOString()}::timestamptz
           )
    RETURNING report_id
  `;
  return rows.length;
}
