import 'server-only';
import { auth } from '@/auth';
import { getFacilityStatus } from '@/lib/facility-status';
import { listMachines, queueCounts } from '@/lib/queries';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [machines, qCounts, facility] = await Promise.all([
      listMachines(),
      queueCounts(),
      getFacilityStatus(),
    ]);

    return NextResponse.json({
      machines: machines.map((m) => ({
        id: m.machineId,
        type: m.kind === '세탁기' ? 'washer' : m.kind === '건조기' ? 'dryer' : m.kind,
        name: m.name,
        status: m.status === '사용가능' ? 'available' : m.status === '사용중' ? 'inuse' : m.status === '점검중' ? 'inspection' : m.status === '고장' ? 'fault' : m.status,
        remaining: m.minutesLeft ?? 0,
      })),
      queueCounts: {
        washer: qCounts['세탁기'] ?? 0,
        dryer: qCounts['건조기'] ?? 0,
      },
      // 05 P20 · 06 「세탁실」 · F33 · Issue #47 — 기기 단위 상태(위 status)와 별개인
      // 세탁실 전체 점검 상태.
      facilityUnderInspection: facility.isUnderInspection,
    });
  } catch (error) {
    console.error('Failed to fetch machines:', error);
    return NextResponse.json({ error: 'Failed to fetch machines' }, { status: 500 });
  }
}
