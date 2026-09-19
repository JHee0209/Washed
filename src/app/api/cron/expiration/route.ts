// 만료 스케줄러 라우트 (05 P3 · P5 · P7 · 08 · 4번 · Issue #8).
//
// 08 · 4번이 「**서버 스케줄러**가 처리한다 — 배정 10분 만료, 수거 3분 초과,
// 제한 3일 종료, 매월 1일 경고 초기화」로 남겨 둔 자리다. 화면이 켜져 있는지와
// 무관하게 이 라우트 하나만 주기적으로 불리면 만료 판정과 경고가 끝난다.
//
// GET /api/cron/expiration
//   Authorization: Bearer <CRON_SECRET>
// →  { ok, expiredAssignments, startedPickupWaits, expiredPickups,
//       assignedNext, liftedRestrictions, failed }
//
// 손으로 돌릴 때:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<배포주소>/api/cron/expiration
//
// ── 왜 GET 인가
// Vercel Cron 은 GET 만 보내고, 기존 cron 라우트(/api/cron/cleanup)도 GET 이라
// 같은 형태를 지킨다. Closed #35 의 「GET 에 상태 변경 side effect 금지」는
// **사용자용 조회 API**(GET /api/queue)에 대한 규칙이고, 이 작업에서 /api/queue 는
// 전혀 건드리지 않았다 — src/lib/queue-read-only.test.ts 가 그것을 계속 지킨다.
//
// ── 주기
// vercel.json 은 이번 작업에서 건드리지 않았다(팀 확정). 등록 방법은
// docs/08-deployNOTE.md 4번에 적어 두었다 — Vercel Hobby 는 cron 이 하루 1회로
// 제한되므로 10분 · 3분 마감을 지키려면 Pro 의 분 단위 cron 이나 외부 스케줄러가
// 필요하다. 어느 쪽이든 이 라우트를 같은 헤더로 부르기만 하면 된다.

import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runExpirationSweep } from '@/lib/scheduler';

export const runtime = 'nodejs';
// 스케줄러는 캐시되면 안 된다 — 두 번째 호출이 캐시를 돌려받으면 아무것도 처리되지 않는다.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET 이 없어 만료 스케줄러를 돌리지 않았습니다. .env.local.example 을 보세요.');
    }
    return Response.json({ ok: false, message: '권한이 없어요.' }, { status: 401 });
  }

  const result = await runExpirationSweep();

  // 한 단계라도 실패했으면 200 으로 덮지 않는다 — 실행 기록에 성공으로 남으면
  // 만료가 조용히 밀리는 것을 아무도 알아채지 못한다(cleanup 라우트와 같은 판단).
  const status = result.failed.length > 0 ? 500 : 200;
  return Response.json({ ok: result.failed.length === 0, ...result }, { status });
}
