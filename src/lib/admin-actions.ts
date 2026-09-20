// 관리자 콘솔의 조회와 동작 (F23~F30).
//
// docs/design/관리자.dc.html 의 탭 일곱 개가 읽던 localStorage(washed_machines ·
// washed_typequeue · washed_reports · washed_warnings · washed_notices …)를
// 전부 DB 로 옮긴 것이다 (08 · 2번).
//
// 바꾸는 동작은 **서버 액션**으로 둔다 — 라우트를 따로 만들지 않아도 되고,
// 모든 액션이 requireAdmin() 을 먼저 지나므로 권한 검사가 빠질 자리가 없다.

'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/admin-session';
import { drainQueue } from '@/lib/assignment';
import { notifyAssignments } from '@/lib/assignment-notify';
import { sql } from '@/lib/db';
import { updateFacilityInspection } from '@/lib/facility-status';
import { notify } from '@/lib/notify';
import { queueCounts } from '@/lib/queries';
import { expireRunTimers } from '@/lib/usage';
import {
  isWarningIncidentRef,
  requiresWarningIncident,
  type WarningIncidentOption,
  type WarningIncidentRef,
} from '@/lib/warning-rules';

// ─────────────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 탭 1 — 실시간 기기 현황 (F23 · F24 · Issue #48 현재 사용자 · Issue #54 정합성)
 *
 * Issue #54 — machines.status 의 '사용중'은 **배정 시점**(QR 인증 전)에 이미
 * 걸린다(assignment.ts 의 중복 배정 방지 락 · 05 P2). 그래서 이 값만 보고 화면을
 * 그리면 QR 을 아직 안 찍은 사람도 실제 사용중처럼 보인다. queue.status
 * (배정 / 사용중 / 수거대기)를 함께 내려줘서 화면이 실제 국면을 구분하게 하고,
 * current_user 는 **queue.status = '사용중'일 때만** 채운다 — 배정·수거대기
 * 중에는 아직 실사용자로 보여주지 않는다(사용자 확정). machines.status 자체는
 * 손대지 않는다 — 락 역할은 그대로 둔다.
 */
export async function adminMachines() {
  await requireAdmin();

  // F9 — adminQueue() 와 같은 이유로 여기서도 부른다(05 P5 · Issue #7 · #34).
  // 이 조회가 이제 queue 를 조인하므로, 타이머가 끝났는데도 홈 화면 폴링을
  // 거치지 않은 줄이 낡은 「사용중」 사용자로 보이는 것을 막는다.
  await expireRunTimers();

  return sql<{
    machine_id: string;
    name: string;
    kind: string;
    status: string;
    ends_at: string | null;
    minutes_left: number | null;
    queue_status: string | null;
    current_user_name: string | null;
    current_user_room: string | null;
  }>`
    SELECT m.machine_id, m.name, m.kind, m.status, m.ends_at,
           CASE WHEN m.ends_at IS NULL THEN NULL
                ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (m.ends_at - now())) / 60))::int
           END AS minutes_left,
           q.status AS queue_status,
           CASE WHEN q.status = '사용중' THEN u.name END AS current_user_name,
           CASE WHEN q.status = '사용중' THEN u.room END AS current_user_room
      FROM machines m
      -- queue_machine_once_idx 가 기기당 활성 줄을 하나로 보장하므로 이 LEFT JOIN 은
      -- 행을 늘리지 않는다. '대기 중'은 machine_id 가 없어 애초에 걸리지 않는다.
      LEFT JOIN queue q ON q.machine_id = m.machine_id
                       AND q.status IN ('배정', '사용중', '수거대기')
      LEFT JOIN users u ON u.user_id = q.user_id
     ORDER BY m.kind, m.name
  `;
}

/**
 * 탭 2 — 실시간 대기열 현황 (F23)
 *
 * `counts` 는 홈 화면(F1 · `/api/machines`)이 쓰는 것과 **같은 함수**
 * (`queries.ts::queueCounts()`)에서 나온 값이다 — 대기 인원 세는 규칙(05 P2 · 08
 * 3번)을 여기서 다시 계산하지 않는다. 두 화면의 숫자가 항상 같은 이유가 이것이다.
 */
export async function adminQueue() {
  await requireAdmin();

  // F9 — 사용 타이머가 끝난 줄을 수거대기로 전환한다(전역 함수 · 05 P5 · Issue #7).
  // 홈 화면 폴링을 거치지 않은 사용자의 줄도 관리자 화면에서 낡은 「사용중」으로
  // 남지 않게 한다.
  await expireRunTimers();

  const [rows, counts] = await Promise.all([
    sql<{
      queue_id: string;
      user_name: string;
      room: string;
      machine_kind: string;
      machine_name: string | null;
      status: string;
      queued_at: string;
      waited_minutes: number;
    }>`
      SELECT q.queue_id, u.name AS user_name, u.room, q.machine_kind,
             m.name AS machine_name, q.status, q.queued_at,
             FLOOR(EXTRACT(EPOCH FROM (now() - q.queued_at)) / 60)::int AS waited_minutes
        FROM queue q
        JOIN users u ON u.user_id = q.user_id
        LEFT JOIN machines m ON m.machine_id = q.machine_id
       WHERE q.status IN ('대기 중', '배정', '사용중', '수거대기')
       ORDER BY q.machine_kind, q.queued_at
    `,
    queueCounts(),
  ]);
  return {
    rows,
    counts: { 세탁기: counts['세탁기'] ?? 0, 건조기: counts['건조기'] ?? 0 },
  };
}

/** 탭 3 — 신고 내역 (F27) */
export async function adminReports() {
  await requireAdmin();
  return sql<{
    report_id: string;
    user_name: string;
    room: string;
    reason: string;
    machine_kind: string | null;
    machine_no: number | null;
    evidence_photo_url: string | null;
    etc_content: string | null;
    status: string;
    created_at: string;
  }>`
    SELECT r.report_id, u.name AS user_name, u.room, r.reason,
           r.machine_kind, r.machine_no, r.evidence_photo_url, r.etc_content,
           r.status, r.created_at
      FROM reports r
      JOIN users u ON u.user_id = r.reporter_user_id
     ORDER BY r.created_at DESC
  `;
}

/** 탭 4 — 이용 내역 (F28 · 조회 3개월 · P17) */
export async function adminHistory() {
  await requireAdmin();
  return sql<{
    history_id: string;
    // 05 P6 · 0008 — F28 「경고 주기」 버튼과 F29 이용 내역 드롭다운이 쓴다.
    // 화면에는 이름 · 호실만 보이고, 이 칸은 버튼 클릭에 실려 서버로만 간다.
    user_id: string;
    user_name: string;
    room: string;
    machine_name: string | null;
    started_at: string;
    ended_at: string;
    result: string;
    used_minutes: number | null;
  }>`
    SELECT h.history_id, h.user_id, u.name AS user_name, u.room, m.name AS machine_name,
           h.started_at, h.ended_at, h.result,
           CASE WHEN h.result = '정상 이용'
                THEN ROUND(EXTRACT(EPOCH FROM (h.ended_at - h.started_at)) / 60)::int
                ELSE NULL
           END AS used_minutes
      FROM usage_history h
      JOIN users u ON u.user_id = h.user_id
      LEFT JOIN machines m ON m.machine_id = h.machine_id
     WHERE h.started_at >= now() - interval '3 months'
     ORDER BY h.started_at DESC
     LIMIT 300
  `;
}

/**
 * 탭 5 — 경고 누적 사용자 (F25 · 05 P5 · P7 · Issue #54)
 *
 * warning_count(usage_restrictions) 와 recent_month_count(warnings)는 서로 다른
 * 값이다 — 전자는 제한 3일 종료 · 매달 1일에 0으로 되돌아가는 "현재 제재" 횟수이고,
 * 후자는 05 SP4(2026-09-17: 1개월로 축소)에 따라 **최근 1개월 warnings 행 수**다.
 * 화면에서 하나로 합치지 않고 각각 보여준다 — 두 축이 의미가 다르다.
 *
 * Issue #54 — 가장 최근 경고 1건(last_reason)만으로는 실제로 어떤 경고를 몇 번
 * 받았는지 관리자가 알 수 없다. `history` 로 최근 1개월 안의 warnings 행을
 * 최신순으로 내려준다.
 *
 * Issue #54 후속 — `history` 는 **현재 경고 수(warning_count, 최대 3)** 만큼만
 * 잘라서 보여준다. `recent_month_count`(1개월 내 실제 warnings 행 수)는 이 제한과
 * 무관하게 그대로 전체 건수다 — 표시 개수만 줄일 뿐 집계·정책은 손대지 않는다.
 * warnings 행 자체나 warning_count 집계 규칙은 여기서 전혀 바꾸지 않는다.
 */
export async function adminWarnings() {
  await requireAdmin();
  return sql<{
    user_id: string;
    user_name: string;
    room: string;
    student_id: string;
    warning_count: number;
    restricted_until: string | null;
    is_restricted: boolean;
    days_left: number | null;
    history: { reason: string; issued_at: string; issued_by: string }[];
    recent_month_count: number;
  }>`
    SELECT u.user_id, u.name AS user_name, u.room, u.student_id,
           COALESCE(r.warning_count, 0) AS warning_count,
           r.restricted_until,
           (r.restricted_until IS NOT NULL AND r.restricted_until > now()) AS is_restricted,
           CASE WHEN r.restricted_until IS NULL OR r.restricted_until <= now() THEN NULL
                ELSE CEIL(EXTRACT(EPOCH FROM (r.restricted_until - now())) / 86400)::int
           END AS days_left,
           COALESCE(w.history, '[]'::json) AS history,
           COALESCE(w.recent_month_count, 0) AS recent_month_count
      FROM users u
      LEFT JOIN usage_restrictions r ON r.user_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT
          (SELECT json_agg(row_to_json(t)) FROM (
             SELECT reason, issued_at, issued_by FROM warnings
              WHERE user_id = u.user_id
                AND issued_at >= now() - interval '1 month'
              ORDER BY issued_at DESC
              -- Issue #54 후속 — 현재 경고 수만큼만, 최대 3건까지 표시한다.
              LIMIT LEAST(COALESCE(r.warning_count, 0), 3)
           ) t) AS history,
          (SELECT COUNT(*)::int FROM warnings
            WHERE user_id = u.user_id
              AND issued_at >= now() - interval '1 month') AS recent_month_count
      ) w ON true
     WHERE COALESCE(r.warning_count, 0) > 0
     ORDER BY COALESCE(r.warning_count, 0) DESC, u.name
  `;
}

/**
 * 탭 6 — 공지사항 (F26 · 05 P18)
 *
 * 등록 후 3개월이 지난 공지는 보이지 않는다. 지우는 것은 서버 배치의 몫이고
 * (08 · 9번 — 아직 없다) 여기서는 **조회**만 자른다. 배치가 생기면 지워진 것은
 * 어차피 안 나오므로 이 필터는 빼도 된다 (08 · 9번).
 */
export async function adminNotices() {
  await requireAdmin();
  return sql<{ notice_id: string; title: string; body: string; created_at: string }>`
    SELECT notice_id, title, body, created_at
      FROM notices
     WHERE created_at >= now() - interval '3 months'
     ORDER BY created_at DESC
  `;
}

/**
 * 탭 7 — 사용자 목록 (F29 · 07-screens.md F29 행 — 이름·학번·호실·경고 횟수·제한 여부)
 *
 * 경고 횟수·제한 여부는 adminWarnings() 와 같은 usage_restrictions 조인을 그대로
 * 재사용한다 — Issue #28: 사용자 목록과 경고 누적 화면이 같은 user_id 기준으로
 * 서로 이어지도록.
 */
export async function adminUsers() {
  await requireAdmin();
  return sql<{
    user_id: string;
    name: string;
    email: string;
    gender: string;
    school: string;
    student_id: string;
    room: string;
    signup_method: string;
    created_at: string;
    withdraw_requested_at: string | null;
    warning_count: number;
    restricted_until: string | null;
    is_restricted: boolean;
    days_left: number | null;
  }>`
    SELECT u.user_id, u.name, u.email, u.gender, u.school, u.student_id, u.room,
           -- Issue #46: 관리자 UI 표시값은 '구글'/'회원가입' 두 가지로만 노출한다
           CASE WHEN u.signup_method = '구글' THEN '구글' ELSE '회원가입' END AS signup_method,
           u.created_at, u.withdraw_requested_at,
           COALESCE(r.warning_count, 0) AS warning_count,
           r.restricted_until,
           (r.restricted_until IS NOT NULL AND r.restricted_until > now()) AS is_restricted,
           CASE WHEN r.restricted_until IS NULL OR r.restricted_until <= now() THEN NULL
                ELSE CEIL(EXTRACT(EPOCH FROM (r.restricted_until - now())) / 86400)::int
           END AS days_left
      FROM users u
      LEFT JOIN usage_restrictions r ON r.user_id = u.user_id
     ORDER BY u.created_at DESC
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 동작
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 기기 상태 바꾸기 — 고장 표시 · 복구 · 강제 사용가능 (F24 · 05 P10)
 *
 * 05 P10 — 「사용 중인 기기는 관리자 페이지에서 **강제 사용가능** 처리로 비운 뒤에만
 * 고장으로 바꿀 수 있다」. 그 「비운다」가 기기 상태만 바꾸는 것이 아니다 — 그 기기를
 * 물고 있던 **줄도 함께 놓아야** 한다. 안 놓으면 queue 행이 그 machine_id 를 계속
 * 쥐고 있어서 `queue_machine_once_idx` 때문에 **그 기기는 다시는 배정되지 않는다**
 * (cancelQueue 가 같은 이유로 기기를 반납한다 · src/lib/assignment.ts 의 NOT EXISTS).
 */
export async function setMachineStatus(machineId: string, status: string) {
  await requireAdmin();
  if (!['사용가능', '사용중', '고장', '점검중'].includes(status)) {
    throw new Error('알 수 없는 상태입니다.');
  }

  // 기기를 사용자 손에서 떼어내는 상태로 갈 때는 물려 있던 줄을 먼저 지운다.
  // 「종료」는 저장되는 상태가 아니라 행 자체를 지우는 것이다 (05 상태값 · 06 「줄서기」).
  if (status !== '사용중') {
    await sql`DELETE FROM queue WHERE machine_id = ${machineId}`;
  }

  await sql`
    UPDATE machines
       SET status = ${status},
           ends_at = CASE WHEN ${status} = '사용중' THEN ends_at ELSE NULL END
     WHERE machine_id = ${machineId}
  `;

  // 05 P2 — 방금 빈 기기를 기다리던 다음 사람에게 넘긴다. 배정 판정은 서버가 한다
  // (08 · 3번). 다음 사람의 10분은 **기기가 사용가능이 된 지금**부터 센다 (08 · 4번).
  if (status === '사용가능') {
    const assigned = await drainQueue();
    // F5 · 05 P26 · Issue #12 — 관리자 동작으로 차례가 된 사람에게 배정 알림.
    if (assigned.length > 0) {
      await notifyAssignments(assigned, 'turn');
    }
    revalidatePath('/home');
  }
  revalidatePath('/admin');
}

/**
 * 세탁실 전체 점검 토글 (F33 · 05 P20 · Issue #47).
 *
 * machines.status 의 '점검중'(setMachineStatus)과 완전히 별개다 — 이 값은 새
 * 줄서기·새 배정 자체를 막는 세탁실 전체 스위치이고, 개별 기기의 점검중 상태는
 * 건드리지 않는다. 이미 배정·사용중인 줄도 그대로 진행된다(P20 — 새 배정만 막는
 * src/lib/assignment.ts::drainQueue() 의 게이트가 그 경계를 지킨다).
 */
export async function setFacilityInspection(next: boolean) {
  await requireAdmin();
  await updateFacilityInspection(next);
  revalidatePath('/admin');
  revalidatePath('/home');
}

/** 기기 추가 (F24) */
export async function addMachine(name: string, kind: string) {
  await requireAdmin();
  if (!name.trim()) throw new Error('기기 이름을 입력해주세요.');
  if (!['세탁기', '건조기'].includes(kind)) throw new Error('세탁기 또는 건조기여야 합니다.');
  await sql`INSERT INTO machines (name, kind) VALUES (${name.trim()}, ${kind})`;
  revalidatePath('/admin');
}

/**
 * 기기 삭제 (F24) — 이용 내역은 machine_id 가 NULL 로 남는다(내역은 지우지 않는다).
 *
 * Issue #5 — **배정 · 사용중 · 수거대기인 줄이 이 기기를 물고 있는 동안은 지우지
 * 않는다.** `queue.machine_id` 의 FK 는 `ON DELETE SET NULL` 이라 지워도 SQL
 * 오류는 나지 않지만, 그러면 `queue.status` 는 '배정'(또는 '사용중' · '수거대기')
 * 그대로인데 `machine_id` 만 NULL 로 남는 고아 줄이 생긴다 — 그 사람은 QR 을 찍을
 * 기기가 없는 채로 10분(05 P3) 타이머만 돌게 된다.
 *
 * 자동으로 다른 기기에 옮겨 주는 것(재배정)은 여기서 만들지 않는다 — 그 판정은
 * drainQueue() 의 몫이 아니고, 정상적으로 대기 중(machine_id 가 아직 없는) 사람들
 * 사이에 새치기를 만들 뿐이다. 가장 보수적으로 **삭제 자체를 막아**, 관리자가 먼저
 * 그 사람의 줄을 정리(취소 · 사용 종료 — Issue #6 · #7 · #8 범위)한 뒤 지우게 한다.
 *
 * 대기 중(machine_id 가 NULL)인 일반 대기열은 이 기기를 가리키지 않으므로 영향이
 * 없다 — 아래 조회가 machine_id 로 좁히기 때문에 애초에 걸리지 않는다.
 */
export async function removeMachine(machineId: string) {
  await requireAdmin();

  const blocking = await sql<{ status: string; n: number }>`
    SELECT status, COUNT(*)::int AS n
      FROM queue
     WHERE machine_id = ${machineId}
       AND status IN ('배정', '사용중', '수거대기')
     GROUP BY status
  `;
  if (blocking.length > 0) {
    const detail = blocking.map((b) => `${b.status} ${b.n}건`).join(', ');
    throw new Error(`이 기기를 이용 중인 줄이 있어 삭제할 수 없습니다 (${detail}). 먼저 정리한 뒤 다시 시도해주세요.`);
  }

  await sql`DELETE FROM machines WHERE machine_id = ${machineId}`;
  revalidatePath('/admin');
}

/**
 * 신고 처리 상태 바꾸기 (F27 · F24 · 05 P9 · P19)
 *
 * P9 — 접수됨 → 처리중 → 처리완료(사실) 순으로 가고, 반려(거짓)는 접수됨 · 처리중
 * 어느 단계에서든 고를 수 있다. **처리완료와 반려는 되돌릴 수 없다.**
 * 그래서 「어디서 어디로」가 허용되는지를 표로 두고 그 밖은 전부 막는다.
 *
 * P19 — 상태가 접수됨에서 바뀌면 **신고한 사람에게만** 결과를 알린다.
 * 신고당한 사람에게는 누가 신고했는지 알리지 않는다.
 */
const REPORT_TRANSITIONS: Record<string, string[]> = {
  접수됨: ['처리중', '반려'],
  처리중: ['처리완료', '반려'],
  // 처리완료 · 반려는 끝난 상태다 — 나가는 길이 없다 (P9)
  처리완료: [],
  반려: [],
};

/** 신고자에게 보낼 결과 문구 (07 화면 문구) */
const REPORT_RESULT_BODY: Record<string, string> = {
  처리중: '접수하신 신고를 확인 중이에요.',
  처리완료: '접수하신 신고의 처리가 완료됐어요.',
  반려: '접수하신 신고는 사실이 아닌 것으로 확인되어 반려됐어요.',
};

export async function setReportStatus(reportId: string, status: string) {
  await requireAdmin();
  if (!REPORT_TRANSITIONS[status]) {
    throw new Error('알 수 없는 상태입니다.');
  }

  const current = await sql<{ status: string; reason: string; reporter_user_id: string }>`
    SELECT status, reason, reporter_user_id FROM reports WHERE report_id = ${reportId} LIMIT 1
  `;
  const row = current[0];
  if (!row) throw new Error('신고를 찾을 수 없습니다.');

  // 같은 상태를 다시 고른 것이면 아무것도 하지 않는다 — 결과 알림이 두 번 가면 안 된다.
  if (row.status === status) {
    return;
  }
  if (!REPORT_TRANSITIONS[row.status].includes(status)) {
    throw new Error(`'${row.status}' 에서 '${status}' 로는 바꿀 수 없습니다.`);
  }

  // 조건부 UPDATE 다 — 읽은 뒤 누가 먼저 바꿨다면 여기서 0줄이 되어 알림도 나가지 않는다.
  const updated = await sql<{ report_id: string }>`
    UPDATE reports
       SET status = ${status}
     WHERE report_id = ${reportId} AND status = ${row.status}
    RETURNING report_id
  `;
  if (updated.length === 0) return;

  // P19 — **신고자에게만.** 「신고당한 사람에게는 누가 신고했는지 알리지 않는다」
  //
  // 받는 사람은 위에서 **DB 에서 읽은** row.reporter_user_id 다 — 이 함수의 인자는
  // reportId 와 status 뿐이고 받는 사람을 밖에서 넣을 길이 없다. 관리자 화면이
  // 무엇을 보내든 알림은 그 신고를 쓴 사람에게만 간다.
  //
  // notify() 는 user_id 하나에 한 줄을 넣는다 — addNotice() 의 공지처럼 users 를
  // 훑지 않는다. 전체 · 같은 호수 · 피신고자 · 관리자로 새는 경로가 없다.
  // (피신고자는 애초에 reports 에 적히지도 않는다 — 06 「신고」에 그런 칸이 없다.)
  try {
    await notify(
      row.reporter_user_id,
      '결과',
      `신고 결과: ${row.reason}`,
      REPORT_RESULT_BODY[status] ?? '신고 상태가 바뀌었어요.',
    );
  } catch (error) {
    // 상태는 이미 바뀌었다. 알림을 못 만들었다고 되돌리지는 않되, 조용히 넘기지도 않는다.
    console.error('신고 결과 알림 생성 실패', reportId, error);
  }

  revalidatePath('/admin');
  revalidatePath('/notifications');
}

/**
 * 경고 주기 · 빼기 (F25 · F32 · 05 P6-1 · P7).
 *
 * **제한은 관리자가 거는 것이 아니라 시스템이 자동으로 건다** (05 P7):
 *   경고 3회 → 3일 제한. 제한이 끝나면 경고는 0회로 초기화된다.
 * 그래서 경고를 올리고 내릴 때마다 여기서 3회인지 보고 제한을 함께 맞춘다.
 *
 * 관리자가 직접 주는 경고는 P6-1 의 ③(신고를 사실로 확인한 건)뿐이다.
 * ①②(배정 후 10분 미인증 · 다했어요 미클릭)는 시스템이 자동으로 부여한다.
 */

/** 05 P7 — 제한이 걸리는 경고 횟수 */
const WARNING_LIMIT = 3;
/** 05 P7 — 제한 기간(일) */
const RESTRICT_DAYS = 3;

/**
 * warnings INSERT **뒤**의 공통 처리 — 제한 누적(P7) · 알림(P16). issueWarning() ·
 * issueUsageIncidentWarning() 둘 다 이 순서를 따른다: **INSERT 가 먼저, 이 처리는
 * 그 다음**이다. INSERT 가 (05 P6 · 0008 의 부분 UNIQUE 인덱스 등으로) 실패하면
 * 호출부에서 예외가 그대로 던져져 이 함수 자체가 불리지 않는다 — 경고 자체가
 * 안 쌓였는데 제한 횟수만 오르거나 중복 알림이 가는 일이 없다.
 */
async function applyWarningSideEffects(
  userId: string,
  reasonText: string,
  /**
   * Issue #65 — 방금 넣은 경고의 `warnings.issued_at`. 관리자 화면(F25) · 이용기록(F13)이
   * 그 값을 그대로 보여주므로 알림함도 같은 값을 써야 한 사건이 세 화면에서 같은 시각으로
   * 보인다. 이 함수의 INSERT · SELECT 가 경고 INSERT 와 별개의 문장이라(neon-http)
   * 여기서 now() 를 다시 부르면 알림함만 늦은 시각을 보게 된다.
   */
  issuedAt: string,
): Promise<void> {
  // 누적을 올리고, 3회가 되면 그 자리에서 3일 제한을 건다 (P7)
  await sql`
    INSERT INTO usage_restrictions (user_id, warning_count, restricted_from, restricted_until)
    VALUES (
      ${userId}, 1,
      CASE WHEN ${WARNING_LIMIT}::int <= 1 THEN now() ELSE NULL END,
      CASE WHEN ${WARNING_LIMIT}::int <= 1
           THEN now() + make_interval(days => ${RESTRICT_DAYS}::int) ELSE NULL END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      warning_count = usage_restrictions.warning_count + 1,
      restricted_from = CASE
        WHEN usage_restrictions.warning_count + 1 >= ${WARNING_LIMIT}::int THEN now()
        ELSE usage_restrictions.restricted_from END,
      restricted_until = CASE
        WHEN usage_restrictions.warning_count + 1 >= ${WARNING_LIMIT}::int
        THEN now() + make_interval(days => ${RESTRICT_DAYS}::int)
        ELSE usage_restrictions.restricted_until END
  `;

  // 05 P16 — 사용자 알림함에 경고 알림이 남는다.
  // 지금 제한이 걸렸는지는 DB 가 판정한다(서버 시각 기준 · P7).
  const restriction = await sql<{ days_left: number | null }>`
    SELECT CASE WHEN restricted_until IS NULL OR restricted_until <= now() THEN NULL
                ELSE CEIL(EXTRACT(EPOCH FROM (restricted_until - now())) / 86400)::int
           END AS days_left
      FROM usage_restrictions
     WHERE user_id = ${userId}
     LIMIT 1
  `;
  const daysLeft = restriction[0]?.days_left ?? null;

  try {
    await notify(
      userId,
      '경고',
      '경고가 1회 누적됐어요',
      daysLeft
        ? `${reasonText} — 경고 ${WARNING_LIMIT}회가 되어 ${daysLeft}일 동안 줄서기를 할 수 없어요.`
        : `${reasonText} — 경고 ${WARNING_LIMIT}회가 되면 ${RESTRICT_DAYS}일 동안 줄서기를 할 수 없어요.`,
      { receivedAt: issuedAt },
    );
  } catch (error) {
    console.error('경고 알림 생성 실패', userId, error);
  }

  revalidatePath('/admin');
  revalidatePath('/history');
  revalidatePath('/notifications');
}

/** 23505 가 지정한 제약에서 났는지 — queue/[kind]/route.ts 의 constraintOf() 와 같은 관용구 */
function isUniqueViolation(error: unknown, ...constraints: string[]): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; constraint?: string };
  return e.code === '23505' && constraints.includes(e.constraint ?? '');
}

/**
 * F29 — 경고를 줄 때 고를 수 있는 「사건」 목록 (05 P6 · 08 · 4번 · Issue #8).
 *
 * 관리자가 사유만 보내면 서버는 그 경고가 **어느 사건**에서 나왔는지 알 수 없어
 * 자동 경고와 겹치는지 판별할 방법이 없다. 사유만으로 막으면 다른 날 · 다른 이용
 * 건의 같은 사유까지 막혀 버리는데, 그건 정책이 아니다(05 P16 — 경고는 사람 단위로
 * 누적되고, 사건마다 따로 쌓인다). 그래서 고를 거리를 내려준다.
 *
 * 두 종류를 한 목록으로 합쳐 최신순으로 준다.
 *   · queue — 아직 진행 중인 줄서기 한 줄. 여기에 먼저 경고를 주면 나중에 스케줄러가
 *     같은 줄을 만료시켜도 경고를 더 얹지 않는다(0012).
 *   · usage — 이미 끝난 이용 한 건. 스케줄러가 강제 종료하며 경고를 매긴 건은
 *     already_warned 로 표시된다(0008).
 *
 * **already_warned 는 안내일 뿐 검사가 아니다** — 조회와 INSERT 사이에 스케줄러가
 * 끼어들 수 있으므로 실제 차단은 DB 의 부분 UNIQUE 인덱스가 한다.
 *
 * 기간은 경고 기록 보관과 같은 **1개월**이다(05 SP4) — 그보다 오래된 이용 건은
 * 경고를 줘도 곧 지워질 기록이라 고를 이유가 없다.
 */
export async function adminUserIncidents(userId: string): Promise<WarningIncidentOption[]> {
  await requireAdmin();
  const rows = await sql<{
    kind: string;
    id: string;
    label: string;
    already_warned: boolean;
  }>`
    SELECT kind, id, label, already_warned
      FROM (
        -- 진행 중인 줄서기 (05 상태값 — 「종료」는 행이 사라지는 것이라 여기 없다)
        SELECT 'queue' AS kind,
               q.queue_id::text AS id,
               '진행 중 · ' || COALESCE(m.name, q.machine_kind) || ' · ' || q.status AS label,
               EXISTS (SELECT 1 FROM warnings w WHERE w.incident_queue_id = q.queue_id) AS already_warned,
               q.queued_at AS sort_at
          FROM queue q
          LEFT JOIN machines m ON m.machine_id = q.machine_id
         WHERE q.user_id = ${userId}

        UNION ALL

        -- 끝난 이용 (06 「이용 내역」)
        SELECT 'usage' AS kind,
               h.history_id::text AS id,
               to_char(h.ended_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') || ' 종료 · '
                 || COALESCE(m.name, '기기 삭제됨')
                 || CASE WHEN h.result = '경고' THEN ' · 경고' ELSE '' END AS label,
               -- canonical 사건 키(0013)를 먼저 본다 — 만료 **전에** 그 줄서기에 경고를
               -- 줬어도 같은 사건으로 잡힌다. usage_history_id 는 0013 이전 행을 위한
               -- fallback 이다(그 행들은 source_queue_id 가 없다).
               EXISTS (
                 SELECT 1 FROM warnings w
                  WHERE w.incident_queue_id = h.source_queue_id
                     OR w.usage_history_id = h.history_id
               ) AS already_warned,
               h.ended_at AS sort_at
          FROM usage_history h
          LEFT JOIN machines m ON m.machine_id = h.machine_id
         WHERE h.user_id = ${userId}
           AND h.ended_at >= now() - interval '1 month'
      ) incidents
     ORDER BY sort_at DESC
     LIMIT 30
  `;

  // SQL 이 'queue' · 'usage' 리터럴만 내지만 화면까지 string 으로 흘려보내지 않는다 —
  // 여기서 한 번 좁혀 두면 호출부에 cast 가 필요 없고, 모르는 값은 조용히 빠진다.
  return rows.flatMap((r) => {
    const ref = { kind: r.kind, id: r.id };
    if (!isWarningIncidentRef(ref)) return [];
    return [{ ...ref, label: r.label, already_warned: r.already_warned }];
  });
}

/**
 * 관리자 경고 한 줄을 INSERT 한다 — issueWarning() · issueUsageIncidentWarning() 의 공통 몸통.
 *
 * 사건(`incident`)이 있으면 그 참조 칸을 채우고, 없으면 예전처럼 비운다. 사건이 있을
 * 때는 **그 행이 정말 이 사용자의 것인지** 서버가 먼저 확인한다 — 화면이 잘못된 id 를
 * 보낼 리는 없지만, 다른 사람에게 경고가 잘못 붙는 것을 서버에서도 막는다.
 *
 * 같은 사건을 가리키는 경고가 이미 있으면(자동이든 관리자든) 부분 UNIQUE 인덱스가
 * INSERT 를 23505 로 거부한다 — 여기서 잡아 사람이 읽을 메시지로 바꾼다.
 * **이 INSERT 가 실패하면 호출부가 그 자리에서 끝난다** — usage_restrictions 증가도
 * notify() 도 뒤에 있어 실행되지 않는다.
 *
 * @returns DB 가 채운 `warnings.issued_at` — 05 P16 · Issue #65 의 "실제로 경고를 받은
 *   시각"이다. 알림함이 이 값을 그대로 쓰도록 applyWarningSideEffects() 로 넘긴다.
 */
async function insertAdminWarning(
  userId: string,
  reason: string,
  incident: WarningIncidentRef | null,
): Promise<string> {
  let usageHistoryId: string | null = null;
  let incidentQueueId: string | null = null;

  if (incident) {
    // 서버 액션의 인자는 클라이언트 입력이다 — 모양부터 본다. 모르는 kind 를 queue 로
    // 넘겨짚으면 엉뚱한 표의 uuid 가 사건 키로 들어가 중복 검사가 조용히 빗나간다.
    if (!isWarningIncidentRef(incident)) {
      throw new Error('사건 정보가 올바르지 않아요.');
    }

    if (incident.kind === 'usage') {
      const row = await sql<{ user_id: string; source_queue_id: string | null }>`
        SELECT user_id, source_queue_id FROM usage_history WHERE history_id = ${incident.id} LIMIT 1
      `;
      if (!row[0]) throw new Error('이용 내역을 찾을 수 없어요.');
      if (row[0].user_id !== userId) throw new Error('이 사건은 선택한 사용자의 것이 아니에요.');

      usageHistoryId = incident.id;
      // 05 P6 · 0013 — 이 이용이 나온 줄서기가 사건의 canonical 이름이다. 만료 전에
      // 그 줄에 이미 경고가 있으면 아래 INSERT 가 같은 값에 부딪혀 막힌다.
      // 0013 이전 행은 이 값이 없어 usage_history_id UNIQUE(0008)로만 보호된다.
      incidentQueueId = row[0].source_queue_id;
    } else {
      const row = await sql<{ user_id: string }>`
        SELECT user_id FROM queue WHERE queue_id = ${incident.id} LIMIT 1
      `;
      if (!row[0]) {
        throw new Error('그 줄서기가 이미 끝났어요. 목록을 새로 고친 뒤 다시 골라주세요.');
      }
      if (row[0].user_id !== userId) throw new Error('이 사건은 선택한 사용자의 것이 아니에요.');

      incidentQueueId = incident.id;
    }
  }

  try {
    const [inserted] = await sql<{ issued_at: string }>`
      INSERT INTO warnings (user_id, reason, issued_by, usage_history_id, incident_queue_id)
      VALUES (${userId}, ${reason}, '관리자', ${usageHistoryId}, ${incidentQueueId})
      -- ::text 로 받는다 — 드라이버의 JS Date 변환은 마이크로초를 버린다(Issue #65).
      RETURNING issued_at::text AS issued_at
    `;
    return inserted.issued_at;
  } catch (error) {
    if (isUniqueViolation(error, 'warnings_usage_history_id_idx', 'warnings_incident_queue_id_idx')) {
      throw new Error('이미 이 사건에 경고가 있어요.');
    }
    throw error;
  }
}

/**
 * F25 · F29 — 관리자가 손으로 주는 경고.
 *
 * `incident` 는 **선택**이다(05 P6 · Issue #8). 고르면 그 사건에 경고가 한 번만
 * 붙도록 DB 가 지켜 준다 — 자동 경고가 이미 그 사건에 있으면 여기서 막히고, 반대로
 * 여기서 먼저 주면 나중에 스케줄러가 그 사건을 만료시켜도 경고를 더 얹지 않는다
 * (expiration.ts 의 applySystemWarning). 고르지 않으면 예전과 똑같이 사건 없는
 * 경고가 되고, 그 경우 자동 경고와의 교차 중복은 막을 수 없다 — 사건을 모르면
 * 판별할 근거가 없기 때문이다.
 *
 * **사유만으로 막지 않는다.** 다른 날 · 다른 이용 건에서 같은 사유가 나오면 각각
 * 정상적으로 경고가 쌓여야 한다.
 */
export async function issueWarning(
  userId: string,
  reason: string,
  incident: WarningIncidentRef | null = null,
) {
  await requireAdmin();
  if (!reason.trim()) throw new Error('사유를 입력해주세요.');

  // 05 P6 — 자동 경고와 겹칠 수 있는 사유는 사건 없이 줄 수 없다. **화면을 믿지 않는다**
  // — 서버 액션은 클라이언트가 직접 부를 수 있으므로 여기서 다시 본다.
  if (requiresWarningIncident(reason) && !incident) {
    throw new Error('이 경고는 관련 사건을 선택해야 해요.');
  }

  const issuedAt = await insertAdminWarning(userId, reason.trim(), incident);
  await applyWarningSideEffects(userId, reason.trim(), issuedAt);
}

/**
 * F28 「경고 주기」· F29 「이용 내역 관련 경고」 — 05 P6 · 0008.
 *
 * 특정 usage_history 행(사건)에 연결된 관리자 경고 전용이다. `reason` 은 늘
 * '신고 확인'(P6-1의 관리자 몫)으로 고정하고, `usageHistoryId` 는 **필수**다.
 *
 * Issue #8 이후 몸통은 issueWarning() 과 같은 insertAdminWarning() 하나다 —
 * 소유자 확인도 23505 처리도 그쪽에 있다. 이 함수는 사유를 '신고 확인'으로
 * 고정하고 사건 종류를 'usage' 로 못박는 얇은 껍데기로만 남는다(같은 INSERT 를
 * 두 벌 두지 않는다).
 */
export async function issueUsageIncidentWarning(userId: string, usageHistoryId: string) {
  await requireAdmin();
  if (!usageHistoryId) throw new Error('연결할 이용 내역을 선택해주세요.');

  const issuedAt = await insertAdminWarning(userId, '신고 확인', { kind: 'usage', id: usageHistoryId });
  await applyWarningSideEffects(userId, '신고 확인', issuedAt);
}

/**
 * 경고 1회 빼기 (F32 — 관리자가 잘못 준 경고를 되돌린다).
 * 가장 최근 경고 한 줄을 지우고 누적을 내린다.
 * 3회 아래로 내려가면 제한도 함께 푼다 (P7 의 역방향).
 */
export async function revokeWarning(userId: string) {
  await requireAdmin();

  await sql`
    DELETE FROM warnings
     WHERE warning_id = (
       SELECT warning_id FROM warnings
        WHERE user_id = ${userId}
        ORDER BY issued_at DESC
        LIMIT 1
     )
  `;

  await sql`
    UPDATE usage_restrictions
       SET warning_count = GREATEST(0, warning_count - 1),
           restricted_from = CASE
             WHEN GREATEST(0, warning_count - 1) < ${WARNING_LIMIT}::int THEN NULL
             ELSE restricted_from END,
           restricted_until = CASE
             WHEN GREATEST(0, warning_count - 1) < ${WARNING_LIMIT}::int THEN NULL
             ELSE restricted_until END
     WHERE user_id = ${userId}
  `;
  revalidatePath('/admin');
  revalidatePath('/history');
}

/**
 * 제한을 직접 풀기 (F25).
 * P7 대로 제한이 끝나면 경고는 **0회로 초기화**되므로, 손으로 풀 때도 같이 0 으로 만든다.
 * 걸 때는 쓰지 않는다 — 제한은 경고 3회에서 자동으로 걸린다.
 */
export async function clearRestriction(userId: string) {
  await requireAdmin();
  await sql`
    UPDATE usage_restrictions
       SET warning_count = 0, restricted_from = NULL, restricted_until = NULL
     WHERE user_id = ${userId}
  `;
  revalidatePath('/admin');
  revalidatePath('/history');
}

/**
 * 공지 올리기 (F26 · 05 P18)
 *
 * P18 — 「등록한 공지는 사생 알림함의 "공지" 탭에 자동으로 반영된다. 따로 발송하지
 * 않는다.」 그래서 공지를 넣는 것과 사람마다 알림함 줄을 만드는 것은 **한 문장**으로
 * 한다. 두 번에 나눠 보내면 앞은 성공하고 뒤가 실패했을 때 "공지는 있는데 아무도
 * 알림함에서 못 보는" 상태가 남는다. db.ts 는 트랜잭션을 열어 주지 않으므로
 * CTE 로 한 문장을 만든다.
 *
 * 탈퇴를 신청한 사람은 빼 둔다 — 즉시 이용이 정지된 상태다 (05 P24).
 *
 * [?] 폰 알림은 보내지 않는다. P18 이 "따로 발송하지 않는다" 이고 08 · 12번이 푸시를
 * 보내는 자리를 배정 · 종료 · 경고 · 신고 결과 넷으로 열거하며 공지를 넣지 않았다.
 * 팀이 보내기로 정하면 아래 INSERT 뒤에 sendPushToUser() 를 도는 단계를 더한다
 * (DB 가 커밋된 뒤 best-effort 로 — 05 P26).
 */
export async function addNotice(title: string, body: string) {
  await requireAdmin();
  if (!title.trim() || !body.trim()) throw new Error('제목과 내용을 모두 입력해주세요.');

  await sql`
    WITH new_notice AS (
      INSERT INTO notices (title, body)
      VALUES (${title.trim()}, ${body.trim()})
      RETURNING notice_id, title, body
    )
    INSERT INTO notifications (user_id, kind, title, body, notice_id)
    SELECT u.user_id, '공지', n.title, n.body, n.notice_id
      FROM users u CROSS JOIN new_notice n
     WHERE u.withdraw_requested_at IS NULL
  `;

  revalidatePath('/admin');
  revalidatePath('/notifications');
}

/**
 * 공지 지우기 (F26 · 05 P18)
 *
 * 「관리자가 공지를 삭제하면 알림함에서도 사라진다」 — notifications.notice_id 의
 * ON DELETE CASCADE(0004)가 딸린 알림을 함께 지우므로 여기서 따로 지우지 않는다.
 */
export async function removeNotice(noticeId: string) {
  await requireAdmin();
  await sql`DELETE FROM notices WHERE notice_id = ${noticeId}`;
  revalidatePath('/admin');
  revalidatePath('/notifications');
}

/**
 * 대기열에서 빼기 (F23) — 관리자가 막힌 줄을 푸는 자리.
 *
 * 「종료」는 저장되는 상태가 아니다(05 상태값) — `queue` 에는 취소됨 같은 상태값이
 * 없고(`db/schema.sql` 의 CHECK 는 대기 중 · 배정 · 사용중 · 수거대기 뿐이다), 끝난
 * 줄은 행 자체를 지운다. 배정된 줄을 지울 때는 물려 있던 기기도 함께 반납해야
 * 한다 — 안 그러면 그 기기가 영원히 「사용중」으로 남는다.
 */
export async function cancelQueue(queueId: string) {
  await requireAdmin();
  await sql`
    WITH removed AS (
      DELETE FROM queue WHERE queue_id = ${queueId} RETURNING machine_id
    )
    UPDATE machines SET status = '사용가능', ends_at = NULL
     WHERE machine_id = (SELECT machine_id FROM removed WHERE machine_id IS NOT NULL)
  `;

  // 05 P2 — 반납된 기기를 기다리던 다음 사람에게 곧바로 넘긴다. 이 호출이 없으면
  // 기기는 비어 있는데 대기자는 계속 기다리는 상태로 남는다 (08 · 3번).
  // 다음 사람의 10분은 여기서부터 센다 — 앞사람의 3분은 들어가지 않는다 (08 · 4번).
  const assigned = await drainQueue();
  // F5 · 05 P26 · Issue #12 — 관리자가 대기열을 빼며 생긴 여지로 차례가 된 사람에게
  // 배정 알림.
  if (assigned.length > 0) {
    await notifyAssignments(assigned, 'turn');
  }
  revalidatePath('/admin');
  revalidatePath('/home');
}
