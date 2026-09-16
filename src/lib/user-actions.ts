// 사생 본인이 자기 계정에 하는 동작.
//
// 관리자 쪽(admin-actions.ts)과 마찬가지로 **서버 액션**으로 둔다 — 모든 함수가
// auth() 를 먼저 지나므로 「누구인지 확인하는 줄」이 빠질 자리가 없다.

'use server';

import { auth, signOut } from '@/auth';
import { sql } from '@/lib/db';

/**
 * 탈퇴 신청 (F36 · 05 P24 · 08 · 9번).
 *
 * P24 — 「탈퇴는 즉시 삭제가 아니라 14일 유예다」. 여기서는 **신청 시각만 적는다.**
 * 실제 삭제(개인정보 · 이용 내역 · 경고 · 신고 · 알림 · 올린 사진)는 14일이 지난 뒤
 * src/lib/cleanup.ts 의 purgeWithdrawnUsers() 가 한다.
 *
 * 증거 사진도 그때 함께 지워진다 (05 P23 「신고자가 탈퇴하면 그 전이라도 함께
 * 삭제한다」) — 배치가 계정을 지우기 **전에** deleteEvidenceForUser() 를 부른다.
 *
 * ── 아직 만들지 않은 것 (Issue #10 범위 밖 · F36)
 * P24 의 나머지 두 문장 — 「복구 기간에는 로그인 시 홈 대신 복구 안내를 띄우고,
 * 같은 학교 이메일의 신규 가입을 막는다」 — 은 여기 없다. 신규 가입 차단은
 * api/auth/signup/send-code 에 이미 있고(withdraw_requested_at 확인), 복구 안내
 * 화면은 F36 에서 만든다. src/auth.ts 는 탈퇴 대기 계정의 로그인을 일부러
 * 통과시키므로(그 파일 88줄) 신청한 사람이 잠기지는 않는다.
 *
 * 이미 신청한 사람이 다시 눌러도 시각을 덮어쓰지 않는다 — 누르는 것만으로
 * 14일이 계속 미뤄지면 유예가 끝나지 않는다.
 */
export async function requestWithdrawal(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('로그인이 필요해요.');

  await sql`
    UPDATE users
       SET withdraw_requested_at = now()
     WHERE user_id = ${userId}
       AND withdraw_requested_at IS NULL
  `;

  // 신청과 동시에 로그아웃한다 (07 흐름표 — 탈퇴 후 로그인 화면으로).
  await signOut({ redirectTo: '/login' });
}
