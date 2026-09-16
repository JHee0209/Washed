// 사생 본인이 자기 계정에 하는 동작.
//
// 관리자 쪽(admin-actions.ts)과 마찬가지로 **서버 액션**으로 둔다 — 모든 함수가
// auth() 를 먼저 지나므로 「누구인지 확인하는 줄」이 빠질 자리가 없다.

'use server';

import { revalidatePath } from 'next/cache';

import { auth, signOut } from '@/auth';
import { sql } from '@/lib/db';
import { withdrawPurgeCutoff } from '@/lib/retention';

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
 * ── P24 의 나머지 두 문장이 놓인 자리 (F36)
 * 「복구 기간에는 로그인 시 홈 대신 복구 안내를 띄우고, 같은 학교 이메일의 신규
 * 가입을 막는다」 — 신규 가입 차단은 api/auth/signup/send-code 에 있고
 * (withdraw_requested_at 확인), 복구 안내는 src/app/withdraw/page.tsx 다.
 * src/auth.ts 는 탈퇴 대기 계정의 **로그인은 일부러 통과시키고**, 화면을 가르는 일은
 * auth.config.ts 의 authorized 가 한다 — 신청한 사람이 잠겨서 복구조차 못 하는 일이
 * 없어야 하기 때문이다.
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

/**
 * 탈퇴 취소 · 계정 복구 (F36 · 05 P24).
 *
 * P24 — 「탈퇴를 신청하면 즉시 이용이 정지되고 **14일 동안 복구할 수 있다.**」
 * 신청 시각을 비우면 정상 계정으로 돌아간다. auth.ts 의 jwt 콜백이 매 요청 users 를
 * 다시 읽으므로(06 「세션은 저장 항목이 아니다」) 다음 요청부터 바로 홈을 쓸 수 있다.
 *
 * ── 14일이 지난 계정은 스스로 되살릴 수 없다
 * 조건의 마지막 줄이 그것이다. 배치는 하루 한 번 도므로 「14일이 지났지만 아직 지워지지
 * 않은」 창이 최대 하루 생기는데, 그 사이에 복구를 허용하면 유예가 사실상 15일이 된다.
 * 무엇보다 **지워질지 말지가 배치를 언제 돌렸는지에 따라 갈리게** 된다 — 같은 조건을
 * cleanup.ts 와 공유해(withdrawPurgeCutoff) 한쪽에서 지울 대상은 다른 쪽에서 복구되지
 * 않게 맞춘다.
 *
 * 누구를 복구할지는 세션에서만 온다 — 클라이언트가 보낸 userId · email 은 받지 않는다.
 */
export async function cancelWithdrawal(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('로그인이 필요해요.');

  const restored = await sql<{ user_id: string }>`
    UPDATE users
       SET withdraw_requested_at = NULL
     WHERE user_id = ${userId}
       AND withdraw_requested_at IS NOT NULL
       AND withdraw_requested_at > ${withdrawPurgeCutoff().toISOString()}::timestamptz
    RETURNING user_id
  `;

  if (restored.length === 0) {
    // 탈퇴를 신청한 적이 없거나(이미 정상), 14일이 지나 되돌릴 수 없는 계정이다.
    throw new Error('복구할 수 있는 기간이 지났어요.');
  }

  // 화면이 들고 있던 「탈퇴 대기」 상태를 버리게 한다.
  revalidatePath('/withdraw');
  revalidatePath('/home');
}
