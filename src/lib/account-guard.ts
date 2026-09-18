// 탈퇴 대기 계정을 막는 한 줄 (05 P24 · F36).
//
// P24 — 「탈퇴를 신청하면 **즉시 이용이 정지되고** 14일 동안 복구할 수 있다.」
//
// 화면은 auth.config.ts 의 authorized 가 복구 안내로 돌려보낸다. 그런데 화면만 막으면
// **API 를 직접 부르는 길이 열린 채로 남는다** — 탈퇴를 신청해 놓고 줄서기나 신고를
// 계속하는 것이 막히지 않는다. 그래서 사생이 무언가를 **쓰는** 라우트는 이 검사를
// 함께 지난다.
//
// 읽기(알림함 조회 · 안 읽은 개수 · 기기 현황)는 막지 않는다 — 복구를 결정하기 전에
// 자기 기록을 확인하는 것까지 막을 이유가 없고, P24 가 정지시키는 것은 「이용」이다.
//
// ── 추가 조회가 없다
// 값은 세션에서 온다. auth.ts 의 jwt 콜백이 매 요청 users 를 다시 읽어 토큰에 넣어
// 두므로(06 「세션은 저장 항목이 아니다」), 여기서 DB 를 한 번 더 보지 않아도 복구
// 직후부터 곧바로 풀린다.

import 'server-only';

import type { Session } from 'next-auth';

/**
 * 탈퇴 대기 중이면 403 Response 를, 아니면 null 을 돌려준다.
 *
 *   const session = await auth();
 *   const userId = session?.user?.id;
 *   if (!userId) return ...401...;
 *   const blocked = withdrawPendingBlock(session);
 *   if (blocked) return blocked;
 *
 * 로그인 검사(401)와 **순서를 지킨다** — 로그인하지 않은 사람에게 탈퇴 상태를
 * 알려 줄 이유가 없다.
 */
export function withdrawPendingBlock(session: Session | null): Response | null {
  if (!session?.withdrawPending) return null;

  return Response.json(
    { ok: false, message: '탈퇴 처리 중인 계정이에요. 계정을 복구한 뒤 이용할 수 있어요.' },
    { status: 403 },
  );
}
