// F10 — "다했어요" 서버 처리 (05 P5 · P6 · R9 · R10 · 08 · 4번 · Issue #7).
//
// 남은 시간과 관계없이(이용 중이든 수거대기든) 그 자리에서 종료한다. 로그인
// 사용자는 세션에서만 가져오고, 클라이언트가 보낸 userId는 받지 않는다 —
// verify-qr/route.ts 와 같은 이유.
//
// 검사 순서:
//   1) 로그인 여부 (401)
//   2) 탈퇴 대기 계정 차단 (403 · account-guard.ts) — 다른 쓰기 라우트와 일관되게.
//   3) 실제 종료 · 기기 반납 · 이용 내역 기록 — src/lib/usage.ts 의 finishUsage()가
//      단일 SQL 문으로 함께 처리한다.
//   4) 성공하면 반납된 기기를 기다리던 다음 대기자에게 바로 넘긴다(05 P2) —
//      queue/[kind]/route.ts 의 POST 와 같은 "두 단계(각각 한 문장)" 패턴.

import 'server-only';
import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { drainQueue } from '@/lib/assignment';
import { notifyAssignments } from '@/lib/assignment-notify';
import { finishUsage } from '@/lib/usage';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }
  const machineId = (body as { machineId?: unknown } | null)?.machineId;
  if (typeof machineId !== 'string' || !machineId) {
    return NextResponse.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 });
  }

  try {
    const result = await finishUsage({ userId, machineId });

    if (result.ok) {
      // 05 P2 — 반납된 기기를 기다리던 다음 사람에게 곧바로 넘긴다.
      const assigned = await drainQueue();
      // F5 · 05 P26 · Issue #12 — 앞사람 종료로 차례가 된 사람에게 배정 알림.
      if (assigned.length > 0) {
        await notifyAssignments(assigned, 'turn');
      }
      return NextResponse.json({
        ok: true,
        machineId: result.machineId,
        serverNow: result.serverNow,
      });
    }

    if (result.reason === 'not_in_use') {
      return NextResponse.json(
        { ok: false, message: '이용 중인 기기가 아니에요.', reason: 'not_in_use' },
        { status: 404 },
      );
    }
    if (result.reason === 'other_user') {
      return NextResponse.json(
        { ok: false, message: '다른 사람이 이용 중인 기기예요.', reason: 'other_user' },
        { status: 403 },
      );
    }
    // 'not_started'
    return NextResponse.json(
      { ok: false, message: '아직 QR 인증 전이에요.', reason: 'not_started' },
      { status: 409 },
    );
  } catch (error) {
    console.error('다했어요 처리 실패', userId, machineId, error);
    return NextResponse.json(
      { ok: false, message: '처리에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
