// F3 · F23 — 내 줄서기 조회 (05 P2).
//
// "대기 인원 세는 규칙을 대기열 조회 API 한 곳에만 둔다"(08 · 2번 · 3번)의 그 한 곳이
// queries.ts::queueCounts() 다 — 이 라우트는 그 값을 그대로 옮길 뿐 다시 계산하지
// 않는다. 홈 화면(src/app/home/page.tsx)이 새로고침 뒤에도 내 대기 · 배정 상태를
// 복원하는 데 쓴다.

import 'server-only';
import { auth } from '@/auth';
import { myQueue } from '@/lib/queries';
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

    const rows = await myQueue(userId);

    const mine: Record<ClientKind, unknown | null> = { washer: null, dryer: null };
    for (const row of rows) {
      const kind = DB_KIND_TO_CLIENT[row.machine_kind];
      if (!kind) continue;
      mine[kind] = {
        status: STATUS_TO_CLIENT[row.status] ?? row.status,
        machineId: row.machine_id,
        machineName: row.machine_name,
        assignDeadlineAt: row.assign_deadline_at,
        queuedAt: row.queued_at,
      };
    }

    return NextResponse.json({ mine });
  } catch (error) {
    console.error('Failed to fetch my queue:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}
