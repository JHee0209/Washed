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
import { sql } from '@/lib/db';
import { notify } from '@/lib/notify';

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

/** 탭 2 — 실시간 대기열 현황 (F23) */
export async function adminQueue() {
  await requireAdmin();
  return sql<{
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
     WHERE q.status IN ('대기 중', '배정됨', '사용 중')
     ORDER BY q.machine_kind, q.queued_at
  `;
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
    user_name: string;
    room: string;
    machine_name: string | null;
    started_at: string;
    ended_at: string;
    result: string;
    used_minutes: number | null;
  }>`
    SELECT h.history_id, u.name AS user_name, u.room, m.name AS machine_name,
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

/** 기기 상태 바꾸기 — 고장 표시 · 복구 (F24 · 05 P13) */
export async function setMachineStatus(machineId: string, status: string) {
  await requireAdmin();
  if (!['사용가능', '사용중', '고장', '점검중'].includes(status)) {
    throw new Error('알 수 없는 상태입니다.');
  }
  await sql`
    UPDATE machines
       SET status = ${status},
           ends_at = CASE WHEN ${status} = '사용중' THEN ends_at ELSE NULL END
     WHERE machine_id = ${machineId}
  `;
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

/** 기기 삭제 (F24) — 이용 내역은 machine_id 가 NULL 로 남는다(내역은 지우지 않는다) */
export async function removeMachine(machineId: string) {
  await requireAdmin();
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

export async function issueWarning(userId: string, reason: string) {
  await requireAdmin();
  if (!reason.trim()) throw new Error('사유를 입력해주세요.');

  await sql`
    INSERT INTO warnings (user_id, reason, issued_by)
    VALUES (${userId}, ${reason.trim()}, '관리자')
  `;

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
        ? `${reason.trim()} — 경고 ${WARNING_LIMIT}회가 되어 ${daysLeft}일 동안 줄서기를 할 수 없어요.`
        : `${reason.trim()} — 경고 ${WARNING_LIMIT}회가 되면 ${RESTRICT_DAYS}일 동안 줄서기를 할 수 없어요.`,
    );
  } catch (error) {
    console.error('경고 알림 생성 실패', userId, error);
  }

  revalidatePath('/admin');
  revalidatePath('/history');
  revalidatePath('/notifications');
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

/** 대기열에서 빼기 (F23) — 관리자가 막힌 줄을 푸는 자리 */
export async function cancelQueue(queueId: string) {
  await requireAdmin();
  await sql`UPDATE queue SET status = '취소됨' WHERE queue_id = ${queueId}`;
  revalidatePath('/admin');
}
