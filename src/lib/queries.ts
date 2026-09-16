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
 */
export async function queueCounts(): Promise<Record<string, number>> {
  const rows = await sql<{ machine_kind: string; n: number }>`
    SELECT machine_kind, COUNT(*)::int AS n
      FROM queue
     WHERE status = '대기 중'
     GROUP BY machine_kind
  `;
  const free = await sql<{ kind: string; n: number }>`
    SELECT kind, COUNT(*)::int AS n
      FROM machines
     WHERE status = '사용가능'
     GROUP BY kind
  `;
  const freeBy = new Map(free.map((f) => [f.kind, f.n]));
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.machine_kind] = (freeBy.get(r.machine_kind) ?? 0) > 0 ? 0 : r.n;
  }
  return out;
}

/** 내 줄서기 (F2 · F3 · 06 「줄서기」) */
export async function myQueue(userId: string) {
  const rows = await sql<{
    queue_id: string;
    machine_kind: string;
    machine_id: string | null;
    machine_name: string | null;
    status: string;
    queued_at: string;
    assign_deadline_at: string | null;
    pickup_deadline_at: string | null;
  }>`
    SELECT q.queue_id, q.machine_kind, q.machine_id, m.name AS machine_name,
           q.status, q.queued_at, q.assign_deadline_at, q.pickup_deadline_at
      FROM queue q
      LEFT JOIN machines m ON m.machine_id = q.machine_id
     WHERE q.user_id = ${userId}
       AND q.status IN ('대기 중', '배정', '사용중', '수거대기')
     ORDER BY q.queued_at
  `;
  return rows;
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
