// F1 · F3 · F5 · F6 — 내 줄서기 조회 (05 P2 · P3).
//
// 홈 화면(src/app/home/page.tsx)이 이 라우트를 주기적으로 다시 읽어 **서버가 정한
// 배정 결과**를 받아 그린다 — 새로고침 뒤 복원만이 아니라, 앞사람이 끝나 내 차례가
// 된 것(F5)도 이 조회로 화면에 닿는다.
//
// **여기서는 배정을 하지 않는다.** 판정은 src/lib/assignment.ts 의 drainQueue() 가
// 하고, 그것을 부르는 자리는 줄서기와 관리자 동작뿐이다(08 · 3번). 조회 라우트에서
// 쓰기를 하면 폴링마다 쓰기가 나가고, 배정이 실패했을 때 순수한 조회까지 함께
// 넘어진다 — 홈이 통째로 「불러오지 못했어요」가 된다.
//
// 대기 인원 세는 규칙(05 P2)은 queries.ts::queueCounts() 한 곳에 있고 이 라우트는
// 다시 계산하지 않는다 (08 · 2번 · 3번).

import 'server-only';
import { auth } from '@/auth';
import { kindWaitEstimates, myQueue } from '@/lib/queries';
import { NextResponse } from 'next/server';

type ClientKind = 'washer' | 'dryer';

const DB_KIND_TO_CLIENT: Record<string, ClientKind> = { 세탁기: 'washer', 건조기: 'dryer' };
const STATUS_TO_CLIENT: Record<string, 'waiting' | 'assigned' | 'inuse' | 'pickup'> = {
  '대기 중': 'waiting',
  배정: 'assigned',
  사용중: 'inuse',
  수거대기: 'pickup',
};

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [rows, estimates] = await Promise.all([myQueue(userId), kindWaitEstimates()]);

    const mine: Record<ClientKind, unknown | null> = { washer: null, dryer: null };
    for (const row of rows) {
      const kind = DB_KIND_TO_CLIENT[row.machine_kind];
      if (!kind) continue;
      mine[kind] = {
        status: STATUS_TO_CLIENT[row.status] ?? row.status,
        machineId: row.machine_id,
        machineName: row.machine_name,
        // 06 「배정 시각」 · 「배정 마감 시각」 — 둘 다 서버가 찍은 값이다 (05 P3)
        assignedAt: row.assigned_at,
        assignDeadlineAt: row.assign_deadline_at,
        pickupDeadlineAt: row.pickup_deadline_at,
        // F8 — QR 인증 성공 뒤 서버가 찍은 종료 예정 시각(05 P4). 세탁 60분 · 건조
        // 45분을 클라이언트가 계산하지 않고 이 값만 그린다(Issue #6).
        endsAt: row.ends_at,
        queuedAt: row.queued_at,
        /** 05 P2 — 내 앞에 남은 대기 인원 */
        ahead: row.ahead,
        /** 05 P2 — 그 종류에서 가장 먼저 끝나는 기기의 종료 예정 시각 (없으면 null) */
        estimatedTurnAt: estimates.byKind[row.machine_kind] ?? null,
      };
    }

    // 화면이 남은 시간을 「마감 − 지금」으로만 그릴 수 있게 서버 시각을 함께 준다.
    // 브라우저 시계로 만료를 판정하지 않는다 (08 · 4번).
    return NextResponse.json({ mine, serverNow: estimates.serverNow });
  } catch (error) {
    console.error('Failed to fetch my queue:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}
