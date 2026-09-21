// 하루 한 번 도는 정리 배치 (05 P23 · P24 · 08 · 9번).
//
// 08 · 9번이 「서버 배치 삭제」로 남겨 둔 자리다. 이 저장소에는 cron 인프라가
// 없었으므로 **라우트 + vercel.json 의 schedule** 로 만든다 — 외부 서비스를
// 새로 들이지 않고 배포 환경에서 그대로 돌릴 수 있는 가장 작은 구조다.
//
// GET /api/cron/cleanup
//   Authorization: Bearer <CRON_SECRET>
// →  { ok: true, expiredEvidence, purgedUsers, purgedUserEvidence, failed }
//
// **아무나 부를 수 있으면 안 된다.** 이 라우트는 사람을 지운다(P24).
// Vercel Cron 은 CRON_SECRET 이 설정되어 있으면 이 헤더를 붙여 부른다.
// 손으로 돌릴 때도 같은 헤더를 쓴다:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<배포주소>/api/cron/cleanup

import { runDailyCleanup } from '@/lib/cleanup';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export const runtime = 'nodejs';
// 배치는 캐시되면 안 된다 — 두 번째 호출이 캐시를 돌려받으면 아무것도 지워지지 않는다.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 검사 내용은 예전 로컬 authorized() 그대로다 — /api/cron/expiration 과 같은
  // 검사를 쓰도록 src/lib/cron-auth.ts 로 옮겼을 뿐이다.
  if (!isAuthorizedCronRequest(request)) {
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET 이 없어 정리 배치를 돌리지 않았습니다. .env.local.example 을 보세요.');
    }
    return Response.json({ ok: false, message: '권한이 없어요.' }, { status: 401 });
  }

  const result = await runDailyCleanup();

  // 한 단계라도 실패했으면 200 으로 덮지 않는다 — Vercel 의 cron 실행 기록에
  // 성공으로 남으면 아무도 알아채지 못한다.
  const status = result.failed.length > 0 ? 500 : 200;
  return Response.json({ ok: result.failed.length === 0, ...result }, { status });
}
