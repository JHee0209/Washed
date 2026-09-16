// 보관 기간이 지난 것을 실제로 지우는 자리 (05 P23 · P24 · 08 · 9번).
//
// 08 · 9번: 「지금은 어느 것도 실제로 지워지지 않는다. 화면에서 거를 뿐이다」
//
// 그 배치 자리를 **증거 사진 범위에서** 연다 (F11 · Issue #10).
// 08 · 9번이 열거한 나머지(이용 내역 · 경고 · 알림 · 공지 3개월 삭제)는 각자의
// 기능에 딸린 일이라 여기서 하지 않는다 — 이 파일에 함수를 더하면 된다.
//
// 부르는 곳은 src/app/api/cron/cleanup/route.ts 하나이고, vercel.json 이
// 그 라우트를 하루 한 번 부른다.

import 'server-only';

import { sql } from '@/lib/db';
import { deleteEvidenceForUser, deleteExpiredEvidence, withdrawPurgeCutoff } from '@/lib/evidence-storage';

export type CleanupResult = {
  /** 05 P23 — 보관 기간이 지나 지운 증거 사진 장수 */
  expiredEvidence: number;
  /** 05 P24 — 유예 기간이 끝나 지운 계정 수 */
  purgedUsers: number;
  /** 그 계정들이 올렸던 증거 사진 장수 (purgedUsers 에 딸린 값) */
  purgedUserEvidence: number;
  /** 실패한 단계의 이름. 비어 있으면 전부 성공이다 */
  failed: string[];
};

/**
 * 05 P24 — 탈퇴 신청 후 14일이 지난 계정을 지운다.
 *
 * 08 · 9번: 「탈퇴는 즉시 삭제가 아니라 14일 유예다 — 탈퇴 신청 시각을 저장하고,
 * 매일 배치로 `탈퇴 신청 + 14일` 이 지난 계정의 개인정보 · 이용 내역 · 경고 · 신고 ·
 * 알림 · 업로드한 사진을 삭제한다. **익명화가 아니라 삭제다.**」
 *
 * ── 순서가 중요하다
 * 사진을 **먼저** 지우고 그 다음에 계정을 지운다. 지금 저장소에서는 users →
 * reports → report_evidence 가 전부 ON DELETE CASCADE 라 계정만 지워도 파일이
 * 함께 사라지지만, 외부 저장소(S3 등)로 옮기면 DB 행은 CASCADE 로 사라져도
 * **파일은 그대로 남는다.** 그때 고칠 곳이 없도록 지금부터 이 순서로 둔다.
 * (05 P23 도 「신고자가 탈퇴하면 그 전이라도 함께 삭제한다」로 같은 것을 요구한다.)
 *
 * 계정을 지우면 신고 · 알림 · 이용 내역 · 경고는 users 를 가리키는 외래키의
 * ON DELETE CASCADE 로 함께 사라진다 (db/schema.sql).
 */
export async function purgeWithdrawnUsers(
  now: Date = new Date(),
): Promise<{ users: number; evidence: number }> {
  const cutoff = withdrawPurgeCutoff(now);

  const due = await sql<{ user_id: string }>`
    SELECT user_id
      FROM users
     WHERE withdraw_requested_at IS NOT NULL
       AND withdraw_requested_at <= ${cutoff.toISOString()}::timestamptz
  `;

  let evidence = 0;
  let users = 0;

  for (const { user_id: userId } of due) {
    // ① 파일 먼저 (저장소 층이 안다 — 외부 저장소로 바뀌어도 여기는 그대로다)
    evidence += await deleteEvidenceForUser(userId);

    // ② 그 다음 계정. 딸린 기록은 CASCADE 로 함께 사라진다.
    const deleted = await sql<{ user_id: string }>`
      DELETE FROM users
       WHERE user_id = ${userId}
         AND withdraw_requested_at IS NOT NULL
         AND withdraw_requested_at <= ${cutoff.toISOString()}::timestamptz
      RETURNING user_id
    `;
    users += deleted.length;
  }

  return { users, evidence };
}

/**
 * 하루 한 번 도는 일 (05 P23 · P24).
 *
 * 한 단계가 실패해도 다음 단계는 돈다 — 사진 삭제가 막혔다고 탈퇴 정리까지
 * 멈추면 P24 의 「14일」이 조용히 늘어난다.
 */
export async function runDailyCleanup(now: Date = new Date()): Promise<CleanupResult> {
  const result: CleanupResult = {
    expiredEvidence: 0,
    purgedUsers: 0,
    purgedUserEvidence: 0,
    failed: [],
  };

  // 05 P23 — 올린 지 3개월이 지난 증거 사진. 신고 기록은 남고 사진만 사라진다.
  try {
    result.expiredEvidence = await deleteExpiredEvidence(now);
  } catch (error) {
    console.error('증거 사진 보관 기간 정리 실패', error);
    result.failed.push('expiredEvidence');
  }

  // 05 P24 — 탈퇴 유예가 끝난 계정.
  // 위가 실패해도 여기는 돈다 — 사진 정리가 막혔다고 탈퇴 정리까지 멈추면
  // P24 의 「14일」이 조용히 늘어난다.
  try {
    const purged = await purgeWithdrawnUsers(now);
    result.purgedUsers = purged.users;
    result.purgedUserEvidence = purged.evidence;
  } catch (error) {
    console.error('탈퇴 계정 정리 실패', error);
    result.failed.push('purgedUsers');
  }

  return result;
}
