// 로그인한 사람의 화면이 읽는 조회들. 서버 컴포넌트에서만 부른다.
//
// **알림은 여기 없다.** 알림함 목록 · 안 읽은 개수 · 읽음 처리는 전부
// src/lib/notifications.ts 한 곳에 있다 — 보관 기간(30일 · 「공지」만 3개월 ·
// 05 P14 · P18)이 목록과 개수에 똑같이 걸려야 하는데, 여기에 필터 없는 사본을
// 두면 두 값이 어긋난다.
//
// API 라우트를 따로 두지 않고 서버 컴포넌트가 바로 읽는다 — 화면과 조회가
// 한 곳에 있어 줄서기 로직이 붙기 전까지 흐름을 따라가기 쉽다.
// 바꾸는 동작(줄서기 · 취소 · 신고)은 나중에 라우트로 뺀다.

import 'server-only';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { sql } from '@/lib/db';

export type Me = {
  userId: string;
  name: string;
  email: string;
  gender: string;
  school: string;
  studentId: string;
  room: string;
  signupMethod: string;
  hasPassword: boolean;
  withdrawRequestedAt: string | null;
};

/**
 * 로그인한 사람을 가져온다. 아니면 로그인 화면으로 보낸다.
 *
 * 매번 DB 를 읽는다 — 세션 표가 없어(JWT 쿠키) 탈퇴(P24) · 이용 제한(P7) 같은
 * 즉시 반영이 필요한 판정을 쿠키에 맡길 수 없기 때문이다 (06).
 */
export async function requireMe(): Promise<Me> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  // 05 P11 — 구글로 들어왔지만 가입을 끝내지 않은 사람
  if (session?.pendingSignup) redirect('/signup?google=1');

  const rows = await sql<{
    user_id: string;
    name: string;
    email: string;
    gender: string;
    school: string;
    student_id: string;
    room: string;
    signup_method: string;
    password_hash: string | null;
    withdraw_requested_at: string | null;
  }>`
    SELECT user_id, name, email, gender, school, student_id, room,
           signup_method, password_hash, withdraw_requested_at
      FROM users
     WHERE email = ${email}
     LIMIT 1
  `;

  const row = rows[0];
  if (!row) redirect('/signup?google=1');

  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    gender: row.gender,
    school: row.school,
    studentId: row.student_id,
    room: row.room,
    signupMethod: row.signup_method,
    hasPassword: Boolean(row.password_hash),
    withdrawRequestedAt: row.withdraw_requested_at,
  };
}

export type Machine = {
  machineId: string;
  name: string;
  kind: string;
  status: string;
  endsAt: string | null;
  /** 남은 분. DB 가 센다 — 렌더 중에 Date.now() 를 부르지 않게. */
  minutesLeft: number | null;
};

/** 기기 목록 (F1 · 06 「기기」) */
export async function listMachines(): Promise<Machine[]> {
  const rows = await sql<{
    machine_id: string;
    name: string;
    kind: string;
    status: string;
    ends_at: string | null;
    minutes_left: number | null;
  }>`
    SELECT machine_id, name, kind, status, ends_at,
           CASE WHEN ends_at IS NULL THEN NULL
                ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (ends_at - now())) / 60))::int
           END AS minutes_left
      FROM machines
     ORDER BY kind, name
  `;
  return rows.map((r) => ({
    machineId: r.machine_id,
    name: r.name,
    kind: r.kind,
    status: r.status,
    endsAt: r.ends_at,
    minutesLeft: r.minutes_left,
  }));
}

/**
 * 종류별 대기 인원 (05 P2).
 * 저장하지 않고 그때그때 센다 — 06 「대기 인원은 저장하지 않는다」.
 * 빈 기기가 있으면 0명, 없으면 그 종류에 줄 선 사람 수.
 *
 * 이 함수는 **대기 인원을 세는 규칙의 유일한 곳**이다 (08 · 2번 · 3번 — 「규칙을
 * 대기열 조회 API 한 곳에만 둔다」). 홈(F1)과 관리자(F23)가 같은 숫자를 보는 이유다.
 *
 * ── 「빈 기기」 판정이 배정과 글자까지 같아야 한다
 * `사용가능` 이지만 **이미 어느 줄이 물고 있는** 기기는 배정에 쓸 수 없다
 * (src/lib/assignment.ts 의 locked_free 가 같은 NOT EXISTS 로 거른다). 조건이 두
 * 곳에서 갈리면 「빈 기기가 있다고 0명이라 적어 놓고 실제로는 아무도 배정되지 않는」
 * 자리가 생긴다. 바꿀 때는 두 곳을 함께 본다.
 *
 * 두 종류를 늘 돌려주므로 부르는 쪽이 `?? 0` 을 붙이지 않아도 된다.
 */
export async function queueCounts(): Promise<Record<string, number>> {
  const rows = await sql<{ kind: string; waiting: number; free: number }>`
    SELECT k.kind,
           (SELECT COUNT(*)::int FROM queue q
             WHERE q.machine_kind = k.kind AND q.status = '대기 중') AS waiting,
           (SELECT COUNT(*)::int FROM machines m
             WHERE m.kind = k.kind AND m.status = '사용가능'
               AND NOT EXISTS (SELECT 1 FROM queue q2 WHERE q2.machine_id = m.machine_id)
           ) AS free
      FROM (VALUES ('세탁기'), ('건조기')) AS k(kind)
  `;
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.kind] = r.free > 0 ? 0 : r.waiting;
  }
  return out;
}

/**
 * 내 줄서기 (F2 · F3 · F5 · F6 · 06 「줄서기」)
 *
 * `server_now` 를 함께 돌려주는 것이 요점이다 — 화면은 남은 시간을 「서버가 준
 * 마감 시각 − 서버가 준 지금」으로만 그린다. 브라우저 시계로 만료를 판정하지
 * 않는다 (08 · 4번). `assigned_at` 도 같은 이유로 내려보낸다.
 */
export async function myQueue(userId: string) {
  const rows = await sql<{
    queue_id: string;
    machine_kind: string;
    machine_id: string | null;
    machine_name: string | null;
    status: string;
    queued_at: string;
    assigned_at: string | null;
    assign_deadline_at: string | null;
    pickup_deadline_at: string | null;
    server_now: string;
    /** 05 P2 — 내 앞에 몇 명이 더 기다리는지 (대기 중일 때만 뜻이 있다) */
    ahead: number;
  }>`
    SELECT q.queue_id, q.machine_kind, q.machine_id, m.name AS machine_name,
           q.status, q.queued_at, q.assigned_at, q.assign_deadline_at, q.pickup_deadline_at,
           now() AS server_now,
           (SELECT COUNT(*)::int FROM queue o
             WHERE o.machine_kind = q.machine_kind
               AND o.status = '대기 중'
               AND (o.queued_at, o.queue_id) < (q.queued_at, q.queue_id)) AS ahead
      FROM queue q
      LEFT JOIN machines m ON m.machine_id = q.machine_id
     WHERE q.user_id = ${userId}
       AND q.status IN ('대기 중', '배정', '사용중', '수거대기')
     ORDER BY q.queued_at
  `;
  return rows;
}

/**
 * 종류별 예상 대기 (05 P2 · 08 · 2번).
 *
 * 05 P2 — 「대기자가 없을 때의 예상 대기는 **그 종류에서 가장 먼저 끝나는 기기의
 * 남은 시간**이다」. 프로토타입이 `washed_typequeue.waitLeftMs` 로 화면끼리
 * 넘기던 값이 이것이고, 서버로 옮기면 조회할 때마다 세면 된다(06 「대기 인원 ·
 * 혼잡도 · 예상 대기는 저장하지 않는다」).
 *
 * 돌아가는 기기가 하나도 없으면 `null` 이다 — 언제 빌지 알 수 없다는 뜻이고,
 * 화면은 그때 카운트다운을 그리지 않는다. 05 에 없는 숫자를 지어내지 않는다.
 */
export async function kindWaitEstimates(): Promise<{
  serverNow: string;
  byKind: Record<string, string | null>;
}> {
  const rows = await sql<{ kind: string; soonest_ends_at: string | null; server_now: string }>`
    SELECT k.kind,
           (SELECT MIN(m.ends_at) FROM machines m
             WHERE m.kind = k.kind AND m.status = '사용중' AND m.ends_at IS NOT NULL
           ) AS soonest_ends_at,
           now() AS server_now
      FROM (VALUES ('세탁기'), ('건조기')) AS k(kind)
  `;
  const byKind: Record<string, string | null> = {};
  for (const r of rows) byKind[r.kind] = r.soonest_ends_at;
  // 두 종류를 늘 돌려주는 질의라 rows 가 비는 일은 없다.
  return { serverNow: rows[0].server_now, byKind };
}

/** 이용 내역 (F13 · 06 「이용 내역」 · 조회는 30일 · P21) */
export async function myHistory(userId: string) {
  return sql<{
    history_id: string;
    machine_name: string | null;
    machine_kind: string | null;
    started_at: string;
    ended_at: string;
    result: string;
    duration_minutes: number;
  }>`
    SELECT h.history_id, m.name AS machine_name, m.kind AS machine_kind,
           h.started_at, h.ended_at, h.result,
           GREATEST(0, ROUND(EXTRACT(EPOCH FROM (h.ended_at - h.started_at)) / 60))::int
             AS duration_minutes
      FROM usage_history h
      LEFT JOIN machines m ON m.machine_id = h.machine_id
     WHERE h.user_id = ${userId}
       AND h.started_at >= now() - interval '30 days'
     ORDER BY h.started_at DESC
  `;
}

/** 내 경고와 이용 제한 (F13 · F6 · 05 P7 · 경고 사유 목록은 30일 · P21) */
export async function myWarnings(userId: string) {
  const warnings = await sql<{
    warning_id: string;
    reason: string;
    issued_by: string;
    issued_at: string;
  }>`
    SELECT warning_id, reason, issued_by, issued_at
      FROM warnings
     WHERE user_id = ${userId}
       AND issued_at >= now() - interval '30 days'
     ORDER BY issued_at DESC
  `;

  // 제한 중인지는 DB 가 판정한다 — 서버 시각이 기준이고,
  // 렌더 중에 Date.now() 를 부르지 않게 된다.
  const restriction = await sql<{
    warning_count: number;
    restricted_from: string | null;
    restricted_until: string | null;
    is_restricted: boolean;
    days_left: number | null;
  }>`
    SELECT warning_count, restricted_from, restricted_until,
           (restricted_until IS NOT NULL AND restricted_until > now()) AS is_restricted,
           CASE WHEN restricted_until IS NULL OR restricted_until <= now() THEN NULL
                ELSE CEIL(EXTRACT(EPOCH FROM (restricted_until - now())) / 86400)::int
           END AS days_left
      FROM usage_restrictions
     WHERE user_id = ${userId}
     LIMIT 1
  `;

  return { warnings, restriction: restriction[0] ?? null };
}


/** 공지 (F17 · 06 「공지」 · 보관 3개월 · P18) */
export async function listNotices() {
  return sql<{ notice_id: string; title: string; body: string; created_at: string }>`
    SELECT notice_id, title, body, created_at
      FROM notices
     WHERE created_at >= now() - interval '3 months'
     ORDER BY created_at DESC
  `;
}

/** 내 신고 (F10 · 06 「신고」) */
export async function myReports(userId: string) {
  return sql<{
    report_id: string;
    reason: string;
    machine_kind: string | null;
    machine_no: number | null;
    status: string;
    created_at: string;
  }>`
    SELECT report_id, reason, machine_kind, machine_no, status, created_at
      FROM reports
     WHERE reporter_user_id = ${userId}
     ORDER BY created_at DESC
  `;
}
