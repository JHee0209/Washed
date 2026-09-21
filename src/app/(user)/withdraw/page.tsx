// 탈퇴 복구 안내 (F36 · 05 P24 · 07 흐름표 「탈퇴 대기 계정으로 로그인하면 → 복구 안내」).
//
// P24 — 「탈퇴를 신청하면 즉시 이용이 정지되고 14일 동안 복구할 수 있다. 14일이 지나면
// 개인정보 · 이용 내역 · 경고 · 신고 · 알림을 영구 삭제한다.」
//
// 여기로 오는 길은 auth.config.ts 의 authorized 다 — 탈퇴를 신청한 사람이 홈 · 기록 ·
// 설정 어디로 가려 해도 이 화면으로 온다. 로그인 자체는 막지 않는다(그러면 복구할 길도
// 함께 막힌다).
//
// **서버가 하는 일은 판정뿐이다** (Issue #13). 화면 문구를 네 언어로 그리려면
// useT() 가 필요하고 그것은 클라이언트에서만 도므로, 그리는 쪽은 withdraw-client.tsx
// 로 갈랐다 — /home · /settings 와 같은 page.tsx + *-client.tsx 짝이다.
//
// **남은 날짜 계산을 클라이언트로 옮기지 않았다.** KST 자정 경계를 세는 정책 판정이라
// 서버 시각으로 해야 한다(CLAUDE.md — 클라이언트 Date.now() 를 정책 판정 기준으로
// 쓰지 않는다). 여기서 세어 숫자로 내려보내고, 화면은 그 숫자를 그리기만 한다.

import { requireMe } from '@/lib/queries';
import { WITHDRAW_GRACE_DAYS } from '@/lib/retention';
import { WithdrawPending, WithdrawRestored } from './withdraw-client';

export const dynamic = 'force-dynamic';

const SEOUL_TZ = 'Asia/Seoul';

/** 남은 날짜 — KST 자정 기준으로 세어 "오늘 하루 남음" 이 어긋나지 않게 한다 */
function daysLeft(deleteAt: Date, now: Date): number {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const start = new Date(`${dayKey.format(now)}T00:00:00Z`).getTime();
  const end = new Date(`${dayKey.format(deleteAt)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export default async function WithdrawPage() {
  const me = await requireMe();

  // 이미 복구된 계정. **redirect 하지 않는다** — 쿠키의 탈퇴 플래그가 아직 갱신되기
  // 전이면 auth.config 가 여기로 되돌려 보내 무한 redirect 가 된다. 안내만 띄우고
  // 사용자가 직접 홈으로 가게 한다(복구 버튼은 성공하면 세션을 새로 고친다).
  if (!me.withdrawRequestedAt) {
    return <WithdrawRestored />;
  }

  const requestedAt = new Date(me.withdrawRequestedAt);
  const deleteAt = new Date(requestedAt);
  deleteAt.setDate(deleteAt.getDate() + WITHDRAW_GRACE_DAYS);

  return (
    <WithdrawPending
      requestedAtIso={requestedAt.toISOString()}
      deleteAtIso={deleteAt.toISOString()}
      daysLeft={daysLeft(deleteAt, new Date())}
    />
  );
}
