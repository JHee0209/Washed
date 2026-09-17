// 만료 스케줄러 — 배정 10분 만료 · 수거 3분 초과 · 이용 제한 자동 해제 · 매달 1일
// 경고 초기화 (05 P3 · P5 · P6 · P7 · P26 · 08 · 4번).
//
// db/schema.sql 의 usage_restrictions 테이블 주석이 이 자리를 정확히 가리킨다:
// "제한 3일 종료를 처리하는 서버 스케줄러가 훑는 자리 (05 P7 · 08 · 4번)".
//
// ── P3/P5 는 어디서 부르나 (하루 1회 cron 만으로는 10분·3분을 못 지킨다)
// assignment.ts 의 머리말: 「배정 10분 만료 · 수거 3분 · 주기 스케줄러는 여기가
// 아니라 08·4번(Issue #8)이다」·「'빈 기기 × 대기자'가 바뀌는 자리에서만 부른다
// — 줄서기(api/queue/[kind])」. 그래서 이 파일의 스윕 함수들은 두 곳에서 부른다 —
// POST /api/queue/[kind](줄서기 때마다, 지연평가) + cleanup.ts 의 하루 1회 배치
// (트래픽이 없을 때의 백스톱). 배정 알고리즘(assignment.ts) · QR 인증(usage.ts)은
// 그대로 두고 함수 호출만 얹는다 — #4/#5/#6 구조를 다시 만들지 않는다.
//
// ── P5 의 "사용중 → 수거대기" 전환도 여기서 만든다 (2026-09-17 팀 확정)
// src/app/home/page.tsx 의 예전 주석은 이 전환(F9 러닝→유예)을 "아직 화면 몫 —
// Issue #7" 이라 적어 두었지만, 08-deployNOTE 4번이 "수거 3분 초과"를 스케줄러
// 4항목 중 하나로 그대로 적어 두고 있어 팀이 **#8이 전환까지 맡는 쪽**으로
// 확정했다. #7 몫은 "다했어요" 버튼 자체(정상 종료 경로)뿐이다 — 그 API 와
// 성공 경로의 usage_history 기록은 여기서 만들지 않는다.
//
// ── P6 · P26 은 별도 스윕이 아니라 이 파일의 습관이다
// 05 P6 — 한 queue 행은 DELETE...RETURNING 으로 **한 번만** 걸리므로(이미 지운
// 행은 다시 안 걸린다) 같은 사건에 경고가 두 번 붙지 않는다 — **단, 이건 자동
// 경고끼리의 중복만 막는다.** "자동 판정과 관리자 수동 부여가 같은 건에 두 번
// 붙지 않게"는 아직 못 막는다 — warnings 에 사건을 가리키는 칸이 없고, 관리자
// 수동 경고(admin-actions.ts issueWarning)는 어떤 신고 · 사건에서 나왔는지 전혀
// 남기지 않는 자유 텍스트라(reports 테이블도 애초에 "누구를 신고하는지" 칸이
// 없다) 지금 구조로는 정확히 판별할 방법이 없다. 이 자리를 채우려면 warnings에
// 사건 참조 칸을 추가하는 마이그레이션과, 관리자 신고 처리 화면이 그 참조를
// 채워 넣는 기능(별도 작업)이 함께 필요하다 — 이번 범위에서는 하지 않는다.
// 05 P26 — 경고 발급은 푸시 허용 여부를 보지 않고, 알림은 항상 notify() 로
// 남긴다(허용하지 않은 사람도 알림함 기록은 그대로 생긴다 · notify.ts 의 원래 설계).

import 'server-only';

import { RUN_MINUTES_BY_KIND } from '@/lib/assignment-rules';
import { sql } from '@/lib/db';
import { isFirstOfMonthInKst } from '@/lib/kst-date';
import { notify } from '@/lib/notify';

/** 05 P7 — 제한이 걸리는 경고 횟수. admin-actions.ts 의 같은 상수와 값이 같아야 한다 */
const WARNING_LIMIT = 3;
/** 05 P7 — 제한 기간(일) */
const RESTRICT_DAYS = 3;

/** 05 P6-1 — 시스템이 자동으로 부여하는 경고 사유 두 가지(신고 확인은 관리자 전용) */
type SystemWarningReason = '배정 후 미인증' | '수거 미완료';

const SYSTEM_WARNING_DESCRIPTION: Record<SystemWarningReason, string> = {
  '배정 후 미인증': '배정 후 10분 안에 QR 인증을 하지 않았어요',
  '수거 미완료': '수거 대기 후 3분 안에 다했어요를 누르지 않았어요',
};

/**
 * 05 P6-1 · P7 · P26 — 시스템 자동 경고 한 건을 매긴다.
 *
 * admin-actions.ts 의 issueWarning() 과 같은 누적·제한 규칙(경고 3회 → 3일 제한)을
 * 쓰되, issued_by 를 '시스템 자동' 으로 남긴다 — 그 함수는 'use server' 라 상수 · 로직을
 * 그대로 가져올 수 없어(서버 액션 파일은 함수만 export 할 수 있다) 여기 따로 둔다.
 * 두 곳의 숫자가 갈리지 않게 05 P7 값(3회 · 3일)만 그대로 옮겨 썼다.
 *
 * **알림 허용 여부를 보지 않는다** — notify() 를 그대로 부르므로, 허용하지 않았거나
 * 구독이 끊긴 사람도 알림함 기록은 똑같이 생긴다(05 P26). 실패해도 경고 자체는
 * 이미 쌓인 뒤라 되돌리지 않는다(admin-actions.ts issueWarning 과 같은 판단).
 */
async function applySystemWarning(
  userId: string,
  reason: SystemWarningReason,
  now: Date,
): Promise<void> {
  const nowIso = now.toISOString();

  await sql`
    INSERT INTO warnings (user_id, reason, issued_by)
    VALUES (${userId}, ${reason}, '시스템 자동')
  `;

  await sql`
    INSERT INTO usage_restrictions (user_id, warning_count, restricted_from, restricted_until)
    VALUES (
      ${userId}, 1,
      CASE WHEN ${WARNING_LIMIT}::int <= 1 THEN ${nowIso}::timestamptz ELSE NULL END,
      CASE WHEN ${WARNING_LIMIT}::int <= 1
           THEN ${nowIso}::timestamptz + make_interval(days => ${RESTRICT_DAYS}::int) ELSE NULL END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      warning_count = usage_restrictions.warning_count + 1,
      restricted_from = CASE
        WHEN usage_restrictions.warning_count + 1 >= ${WARNING_LIMIT}::int THEN ${nowIso}::timestamptz
        ELSE usage_restrictions.restricted_from END,
      restricted_until = CASE
        WHEN usage_restrictions.warning_count + 1 >= ${WARNING_LIMIT}::int
        THEN ${nowIso}::timestamptz + make_interval(days => ${RESTRICT_DAYS}::int)
        ELSE usage_restrictions.restricted_until END
  `;

  const restriction = await sql<{ days_left: number | null }>`
    SELECT CASE WHEN restricted_until IS NULL OR restricted_until <= ${nowIso}::timestamptz THEN NULL
                ELSE CEIL(EXTRACT(EPOCH FROM (restricted_until - ${nowIso}::timestamptz)) / 86400)::int
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
        ? `${SYSTEM_WARNING_DESCRIPTION[reason]} — 경고 ${WARNING_LIMIT}회가 되어 ${daysLeft}일 동안 줄서기를 할 수 없어요.`
        : `${SYSTEM_WARNING_DESCRIPTION[reason]} — 경고 ${WARNING_LIMIT}회가 되면 ${RESTRICT_DAYS}일 동안 줄서기를 할 수 없어요.`,
    );
  } catch (error) {
    console.error('시스템 경고 알림 생성 실패', userId, reason, error);
  }
}

/**
 * 05 P3 — 배정 후 10분 안에 QR 인증이 없으면 배정을 해제하고 경고 1회를 매긴다.
 *
 * **DELETE...RETURNING 한 문장으로 대상을 정한다** — 지운 행은 이 스윕이 두 번
 * 돌아도(cron 과 줄서기 양쪽에서 겹쳐 불려도) 다시 걸리지 않는다(05 P6 · idempotent).
 * 06 「줄서기」의 「종료」는 저장되는 상태가 아니다 — 배정 해제는 그 행을 지우는
 * 것뿐이고, usage_history 에는 남기지 않는다(사용중을 시작한 적이 없어 기록할
 * 이용이 없다 · history/page.tsx 가 '배정 후 미인증'을 경고만으로 표시하는 이유와
 * 같다).
 *
 * 기기는 **배정을 준 뒤로 상태가 바뀌지 않았을 때만** 사용가능으로 되돌린다
 * (`status = '사용중'` 조건) — 관리자가 그새 고장으로 바꿔 놓았다면 덮어쓰지 않는다.
 */
export async function expireOverdueAssignments(now: Date = new Date()): Promise<number> {
  const expired = await sql<{ queue_id: string; user_id: string; machine_id: string }>`
    DELETE FROM queue
     WHERE status = '배정'
       AND assign_deadline_at IS NOT NULL
       AND assign_deadline_at <= ${now.toISOString()}::timestamptz
    RETURNING queue_id, user_id, machine_id
  `;

  for (const row of expired) {
    await sql`
      UPDATE machines
         SET status = '사용가능', ends_at = NULL
       WHERE machine_id = ${row.machine_id}
         AND status = '사용중'
    `;
    await applySystemWarning(row.user_id, '배정 후 미인증', now);
  }

  return expired.length;
}

/**
 * 05 P5 · F9 — 사용 타이머(machines.ends_at)가 끝난 사용중 줄을 수거대기로 옮긴다.
 *
 * 06 「수거 마감 시각(타이머 0 + 3분)」의 "타이머 0" 이 곧 `ends_at` 이다 — 스윕이
 * 늦게 돌아도 마감은 **실제로 타이머가 끝난 시각**을 기준으로 잡는다(스윕이 도는
 * 순간을 기준으로 잡지 않는다 · assign_deadline_at 이 assigned_at 을 기준으로
 * 잡는 것과 같은 이유).
 *
 * 기기(machines)에는 '수거대기' 상태가 없다 — 05 상태값의 기기는 사용가능 · 사용중
 * · 고장 · 점검중 넷뿐이라 기기는 그대로 `사용중` 으로 둔다(수거를 기다리는 동안도
 * 물리적으로는 기기가 점유돼 있다). `queue.status` 만 옮긴다.
 *
 * `q.status = '사용중'` 조건이 있어 이미 옮겨진 행은 다시 걸리지 않는다(idempotent).
 */
export async function transitionFinishedUsageToPickup(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();

  const started = await sql<{ queue_id: string }>`
    UPDATE queue q
       SET status = '수거대기',
           pickup_deadline_at = m.ends_at + interval '3 minutes'
      FROM machines m
     WHERE q.machine_id = m.machine_id
       AND q.status = '사용중'
       AND m.status = '사용중'
       AND m.ends_at IS NOT NULL
       AND m.ends_at <= ${nowIso}::timestamptz
    RETURNING q.queue_id
  `;

  return started.length;
}

/**
 * 05 P5 — 수거대기 후 3분 안에 "다했어요"가 없으면 강제 종료하고 경고 1회를 매긴다.
 *
 * **DELETE...USING...RETURNING 한 문장**으로 대상 행과 그 기기 정보(kind · ends_at)를
 * 함께 가져오면서 지운다 — 지운 행은 두 번 걸리지 않는다(05 P6 · idempotent).
 *
 * usage_history 에 result='경고' 로 남긴다 — 06 「이용 내역」의 시작 시각은
 * `ends_at - RUN_MINUTES_BY_KIND[kind]`(QR 인증 때 서버가 `ends_at = now() + 60분
 * 또는 45분` 으로 찍은 값을 거꾸로 되짚는다 · usage.ts), 종료 시각은
 * `pickup_deadline_at`(정책이 약속한 "3분" 그 시점 — 스윕이 실제로 도는 시각이
 * 아니다)이다. history/page.tsx 가 '수거 미완료' 경고를 이 usage_history 행의
 * `result='경고'` 로만 표시하고 따로 더 그리지 않는 이유가 이 기록이다(중복 방지).
 *
 * 기기는 **그새 관리자가 고장으로 바꾸지 않았을 때만** 사용가능으로 돌린다.
 */
export async function expireOverduePickups(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();

  const expired = await sql<{
    queue_id: string;
    user_id: string;
    machine_id: string;
    machine_kind: string;
    ends_at: string | null;
    pickup_deadline_at: string;
  }>`
    DELETE FROM queue q
      USING machines m
     WHERE q.machine_id = m.machine_id
       AND q.status = '수거대기'
       AND q.pickup_deadline_at IS NOT NULL
       AND q.pickup_deadline_at <= ${nowIso}::timestamptz
    RETURNING q.queue_id, q.user_id, q.machine_id, m.kind AS machine_kind,
              m.ends_at, q.pickup_deadline_at
  `;

  for (const row of expired) {
    await sql`
      UPDATE machines
         SET status = '사용가능', ends_at = NULL
       WHERE machine_id = ${row.machine_id}
         AND status = '사용중'
    `;

    // ends_at 은 transitionFinishedUsageToPickup() 이 이 값을 근거로 pickup_deadline_at
    // 을 찍었으므로 이 시점엔 항상 있어야 한다 — 방어적으로만 없을 때를 가른다.
    const runMinutes = RUN_MINUTES_BY_KIND[row.machine_kind] ?? 0;
    const startedAt = row.ends_at
      ? new Date(new Date(row.ends_at).getTime() - runMinutes * 60 * 1000)
      : new Date(new Date(row.pickup_deadline_at).getTime() - (runMinutes + 3) * 60 * 1000);

    await sql`
      INSERT INTO usage_history (user_id, machine_id, started_at, ended_at, result)
      VALUES (${row.user_id}, ${row.machine_id}, ${startedAt.toISOString()}::timestamptz,
              ${row.pickup_deadline_at}::timestamptz, '경고')
    `;

    await applySystemWarning(row.user_id, '수거 미완료', now);
  }

  return expired.length;
}

/**
 * 05 P7 — 3일 제한이 끝난 사람을 훑어 경고를 0회로 초기화한다.
 *
 * admin-actions.ts 의 clearRestriction()(관리자 수동 해제, F25)과 **같은 최종
 * 상태**로 맞춘다. 조건부 UPDATE 라 이미 풀린 행은 다시 걸리지 않는다 — 스케줄러가
 * 여러 번 돌아도 결과가 깨지지 않는다.
 */
export async function liftExpiredRestrictions(now: Date = new Date()): Promise<number> {
  const rows = await sql<{ user_id: string }>`
    UPDATE usage_restrictions
       SET warning_count = 0, restricted_from = NULL, restricted_until = NULL
     WHERE restricted_until IS NOT NULL
       AND restricted_until <= ${now.toISOString()}::timestamptz
    RETURNING user_id
  `;
  return rows.length;
}

/**
 * 05 P7 — 매달 1일(KST)에 전원 경고를 0회로 초기화한다.
 *
 * "확인할 수 없어 표시해 둔 것"의 팀 확정: 제한 3일 종료 초기화와 매달 1일 초기화
 * 둘 다 유지한다 — 월말에 경고를 받아 제한 중이어도 1일이 되면 0회로 돌아간다.
 * 그래서 liftExpiredRestrictions 와 같은 최종 상태(0/NULL/NULL)로 리셋한다.
 *
 * 1일이 아니면 아무것도 하지 않는다. 같은 날 여러 번 돌아도 이미 0인 행은
 * 다시 바뀌지 않아 idempotent 하다.
 */
export async function resetMonthlyWarnings(now: Date = new Date()): Promise<number> {
  if (!isFirstOfMonthInKst(now)) return 0;

  const rows = await sql<{ user_id: string }>`
    UPDATE usage_restrictions
       SET warning_count = 0, restricted_from = NULL, restricted_until = NULL
     WHERE warning_count > 0
        OR restricted_from IS NOT NULL
        OR restricted_until IS NOT NULL
    RETURNING user_id
  `;
  return rows.length;
}
