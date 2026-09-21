// F9 · 05 P5 — 사용 타이머가 끝난 줄을 수거대기로 옮기는 **명시적 상태 변경 경로**
// (Issue #35).
//
// ── 왜 라우트가 따로 있는가
// 이 전환은 예전에 GET /api/queue 안에서 일어났다. 조회 라우트가 쓰기를 하면
// ① 홈이 5초마다 폴링하므로 폴링마다 UPDATE 가 나가고
// ② 전환이 실패하면 순수한 조회까지 함께 500 이 되어 홈이 통째로 「불러오지 못했어요」가 된다.
// 그래서 조회(GET /api/queue)는 읽기만 하고, 상태 변경은 이 POST 가 맡는다.
//
// ── 무엇을 하고 무엇을 하지 않는가
// **transitionUsageToPickup() 하나만 부른다** — GET 이 원래 부르던 것과 정확히 같은
// 범위다(expireRunTimers() 가 그 함수의 얇은 wrapper였다 · Issue #34). 배정 10분 만료
// (expireOverdueAssignments)와 수거 3분 초과 강제 종료(expireOverduePickups)는 여기서
// 부르지 않는다 — GET 도 부르지 않았고, 그 둘을 상시 경로로 올리는 일은 Issue #8
// (만료 스케줄러 · 경고 자동 부여)의 몫이다. 지금은 줄서기(POST /api/queue/[kind])와
// 하루 1회 배치(cleanup.ts)가 그 둘을 훑는다.
//
// ── 부르는 곳
// 홈 화면이 조회 폴링과 **같은 5초 주기의 별도 요청**으로 부른다(home-client.tsx 의
// SWEEP_MS). 주기를 그대로 둔 것은 #35 가 refactor이기 때문이다 — 전환과 종료
// 알림(#12)이 예전처럼 5초 안에 닿아야 사용자 체감이 바뀌지 않는다. 달라진 것은
// 「같은 요청이 조회와 쓰기를 겸하지 않는다」는 점뿐이다.
// 전역 함수라 누가 불러도 만료된 줄 전체가 전환되므로, 화면을 열어 둔 사람이 한 명이라도
// 있으면 앱을 닫아 둔 사람의 줄도 함께 전환된다 — 예전 폴링이 갖던 성질 그대로다.
// Issue #8 의 서버 스케줄러가 붙으면 그쪽에서도 같은 함수를 부르면 되고, 그때 이
// 클라이언트 스윕 의존성을 없앨 수 있다.
//
// POST /api/queue/sweep → { ok: true, transitioned: number }

import 'server-only';
import { auth } from '@/auth';
import { transitionUsageToPickup } from '@/lib/expiration';
import { NextResponse } from 'next/server';

export async function POST() {
  // 로그인한 사용자만 부를 수 있다. 특정 사용자의 상태를 바꾸는 요청이 아니라
  // 서버 시각으로 만료된 줄을 훑는 전역 스윕이므로, 탈퇴 대기 차단
  // (account-guard.ts)은 걸지 않는다 — 부르는 사람의 이용 여부와 무관하고,
  // 막아도 다른 사람의 만료 처리만 늦어진다.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  try {
    // 05 P26 · Issue #12 — 전환된 줄에만 종료 알림이 붙는다(함수 안에서 처리한다).
    // `WHERE q.status = '사용중'` 가드 덕분에 두 번 불러도 같은 줄은 한 번만 전환된다.
    const started = await transitionUsageToPickup();
    return NextResponse.json({ ok: true, transitioned: started.length });
  } catch (error) {
    // 조회와 분리된 경로이므로 이 실패는 홈의 조회를 건드리지 않는다.
    console.error('사용 타이머 종료 스윕 실패', error);
    return NextResponse.json(
      { ok: false, message: '처리에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
