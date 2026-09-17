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
import { sql } from '@/lib/db';
import { notify } from '@/lib/notify';
import { queueCounts } from '@/lib/queries';

// ─────────────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────────────

/** 탭 1 — 실시간 기기 현황 (F23 · F24) */
export async function adminMachines() {
  await requireAdmin();
  return sql<{
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

/** 탭 5 — 경고 누적 사용자 (F25 · 05 P5 · P7) */
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
    last_reason: string | null;
    last_issued_at: string | null;
  }>`
    SELECT u.user_id, u.name AS user_name, u.room, u.student_id,
           COALESCE(r.warning_count, 0) AS warning_count,
           r.restricted_until,
           (r.restricted_until IS NOT NULL AND r.restricted_until > now()) AS is_restricted,
           CASE WHEN r.restricted_until IS NULL OR r.restricted_until <= now() THEN NULL
                ELSE CEIL(EXTRACT(EPOCH FROM (r.restricted_until - now())) / 86400)::int
           END AS days_left,
           w.reason AS last_reason,
           w.issued_at AS last_issued_at
      FROM users u
      LEFT JOIN usage_restrictions r ON r.user_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT reason, issued_at FROM warnings
         WHERE user_id = u.user_id ORDER BY issued_at DESC LIMIT 1
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

/** 탭 7 — 사용자 목록 (F29) */
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
  }>`
    SELECT user_id, name, email, gender, school, student_id, room,
           signup_method, created_at, withdraw_requested_at
      FROM users
     ORDER BY created_at DESC
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
    await drainQueue();
    revalidatePath('/home');
  }
  revalidatePath('/admin');
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
async function applyWarningSideEffects(userId: string, reasonText: string): Promise<void> {
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
    );
  } catch (error) {
    console.error('경고 알림 생성 실패', userId, error);
  }

  revalidatePath('/admin');
  revalidatePath('/history');
  revalidatePath('/notifications');
}

/** 23505 가 지정한 제약에서 났는지 — queue/[kind]/route.ts 의 constraintOf() 와 같은 관용구 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; constraint?: string };
  return e.code === '23505' && e.constraint === constraint;
}

/** F25 · F29 — 특정 이용 내역과 무관한 일반 경고. usage_history_id 는 항상 비운다. */
export async function issueWarning(userId: string, reason: string) {
  await requireAdmin();
  if (!reason.trim()) throw new Error('사유를 입력해주세요.');

  await sql`
    INSERT INTO warnings (user_id, reason, issued_by)
    VALUES (${userId}, ${reason.trim()}, '관리자')
  `;

  await applyWarningSideEffects(userId, reason.trim());
}

/**
 * F28 「경고 주기」· F29 「이용 내역 관련 경고」 — 05 P6 · 0008.
 *
 * 특정 usage_history 행(사건)에 연결된 관리자 경고 전용이다. `reason` 은 늘
 * '신고 확인'(P6-1의 관리자 몫)으로 고정한다 — 자유 텍스트를 받지 않아 CHECK
 * 위반도 나지 않는다. `usageHistoryId` 는 **필수**다(옵션이 아니다) — 이걸
 * 선택 인자로 두면 그 사건과 무관한 issueWarning() 처럼 그냥 안 채우고 지나갈
 * 수 있어, 자동 경고(P5 수거 미완료)와 같은 사건을 몰래 다시 벌줄 길이 남는다.
 *
 * 같은 usage_history_id 를 가리키는 경고가 이미 있으면(자동이든 관리자든)
 * warnings_usage_history_id_idx 가 INSERT 를 23505 로 거부한다 — 여기서 잡아
 * 사람이 읽을 메시지로 바꾼다. **이 INSERT 가 실패하면 함수가 그 자리에서
 * 끝난다** — usage_restrictions 증가도 notify() 도 뒤에 있어 실행되지 않는다.
 */
export async function issueUsageIncidentWarning(userId: string, usageHistoryId: string) {
  await requireAdmin();
  if (!usageHistoryId) throw new Error('연결할 이용 내역을 선택해주세요.');

  // 고른 이용 내역이 실제로 이 사용자의 것인지 확인한다 — 화면이 잘못된 history_id
  // 를 보낼 리는 없지만, 다른 사람에게 경고가 잘못 붙는 것을 서버에서도 막는다.
  const owner = await sql<{ user_id: string }>`
    SELECT user_id FROM usage_history WHERE history_id = ${usageHistoryId} LIMIT 1
  `;
  if (!owner[0]) throw new Error('이용 내역을 찾을 수 없어요.');
  if (owner[0].user_id !== userId) {
    throw new Error('이 이용 내역은 선택한 사용자의 것이 아니에요.');
  }

  try {
    await sql`
      INSERT INTO warnings (user_id, reason, issued_by, usage_history_id)
      VALUES (${userId}, '신고 확인', '관리자', ${usageHistoryId})
    `;
  } catch (error) {
    if (isUniqueViolation(error, 'warnings_usage_history_id_idx')) {
      throw new Error('이미 이 이용 건에 경고가 있어요.');
    }
    throw error;
  }

  await applyWarningSideEffects(userId, '신고 확인');
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
  await drainQueue();
  revalidatePath('/admin');
  revalidatePath('/home');
}
