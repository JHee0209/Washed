// F8 — QR 인증 서버 검증 (05 P3 · P4 · R8 · 08 · 6번 · Issue #6).
//
// 홈 화면(src/app/(user)/home/qr-scanner.tsx)이 카메라로 디코딩한 QR 문자열을 그대로
// 보내면, 여기서 **최종 판정**을 한다 — 클라이언트는 성공 여부를 스스로 정하지
// 않는다(10번 요구사항). 로그인 사용자는 세션에서만 가져오고, 클라이언트가 보낸
// userId 는 애초에 받지 않는다.
//
// 검사 순서:
//   1) 로그인 여부 (401)
//   2) 탈퇴 대기 계정 차단 (403 · account-guard.ts)
//   3) QR 서명 검증 — 위조 방지 (src/lib/qr.ts)
//   4) 내 배정 · 같은 기기 · 배정 상태 · 10분 이내 — 전부 src/lib/usage.ts 의
//      단일 SQL 문이 서버 시각 기준으로 함께 확인하고, 통과하면 「사용중」으로
//      전환하며 기기의 종료 예정 시각(세탁 60분 · 건조 45분)을 서버가 찍는다.

import 'server-only';
import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { isQrSigningConfigured, verifyMachineQrPayload } from '@/lib/qr';
import { startUsageFromQr } from '@/lib/usage';
import { NextResponse } from 'next/server';

const DB_KIND_TO_CLIENT: Record<string, 'washer' | 'dryer'> = { 세탁기: 'washer', 건조기: 'dryer' };

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, code: 'LOGIN_REQUIRED', message: '로그인이 필요해요.' }, { status: 401 });
  }
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST', message: '잘못된 요청이에요.' }, { status: 400 });
  }
  const payload = (body as { payload?: unknown } | null)?.payload;
  if (typeof payload !== 'string' || !payload) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST', message: '잘못된 요청이에요.' }, { status: 400 });
  }

  // ── 서명 검증을 할 수 있는 서버인지 먼저 본다.
  //
  // QR_SIGNING_SECRET 이 없으면 verifyMachineQrPayload() 는 멀쩡한 기기 스티커까지
  // 전부 null 로 돌려주므로(qr.ts::isQrSigningConfigured 머리말), 아래 위조 분기가
  // 「알 수 없는 QR이에요」로 안내한다 — 사용자에게는 QR 이 잘못된 것처럼 보이고
  // 서버에는 아무 기록도 남지 않는다. 그 사이 queue · machines 는 손도 대지 않으므로
  // 「UI 는 있는데 DB 와 연동되지 않는다」가 된다(Issue #30). 두 경우를 갈라 둔다.
  if (!isQrSigningConfigured()) {
    console.error('QR 인증 불가 — 서버에 QR_SIGNING_SECRET 이 설정돼 있지 않습니다.');
    return NextResponse.json(
      {
        ok: false,
        code: 'QR_SERVER_MISCONFIGURED', message: '서버 설정 문제로 지금은 QR 인증을 할 수 없어요. 관리자에게 알려주세요.',
        reason: 'qr_not_configured',
      },
      { status: 500 },
    );
  }

  // ── 위조 방지 — 서버만 아는 비밀키로 서명된 값인지 (14번 「단순 machineId QR 금지」)
  const verified = verifyMachineQrPayload(payload);
  if (!verified) {
    return NextResponse.json(
      { ok: false, code: 'QR_UNKNOWN', message: '알 수 없는 QR이에요. 기기에 붙은 QR을 다시 찍어주세요.', reason: 'invalid_qr' },
      { status: 400 },
    );
  }

  try {
    const result = await startUsageFromQr({ userId, machineId: verified.machineId });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        machineId: result.machineId,
        machineKind: DB_KIND_TO_CLIENT[result.machineKind] ?? result.machineKind,
        machineName: result.machineName,
        endsAt: result.endsAt,
        serverNow: result.serverNow,
      });
    }

    if (result.reason === 'unknown_machine') {
      // 서명은 맞는데 그 기기가 DB 에 없다 — 사용자가 다시 찍어서 될 일이 아니다.
      console.error('QR 인증 실패 — machines 에 없는 machine_id', verified.machineId);
      return NextResponse.json(
        {
          ok: false,
          code: 'QR_MACHINE_NOT_REGISTERED', message: '등록되지 않은 기기 QR이에요. 관리자에게 알려주세요.',
          reason: 'unknown_machine',
        },
        { status: 404 },
      );
    }
    if (result.reason === 'not_assigned') {
      return NextResponse.json(
        { ok: false, code: 'QR_NOT_ASSIGNED_MACHINE', message: '배정된 기기가 아니에요. 배정받은 기기의 QR을 찍어주세요.', reason: 'not_assigned' },
        { status: 404 },
      );
    }
    if (result.reason === 'other_user') {
      return NextResponse.json(
        { ok: false, code: 'QR_ASSIGNED_TO_OTHER', message: '다른 사람에게 배정된 기기예요.', reason: 'other_user' },
        { status: 403 },
      );
    }
    if (result.reason === 'pickup_pending') {
      return NextResponse.json(
        {
          ok: false,
          code: 'QR_PICKUP_PENDING', message: '이미 사용이 끝나 수거 대기 중이에요. 세탁물을 수거한 뒤 홈에서 「다했어요」를 눌러주세요.',
          reason: 'pickup_pending',
        },
        { status: 409 },
      );
    }
    // 'expired'
    return NextResponse.json(
      { ok: false, code: 'QR_EXPIRED', message: '인증 가능 시간(10분)이 지났어요.', reason: 'expired' },
      { status: 409 },
    );
  } catch (error) {
    console.error('QR 인증 실패', userId, verified.machineId, error);
    return NextResponse.json(
      { ok: false, code: 'QR_VERIFY_FAILED', message: 'QR 인증에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
