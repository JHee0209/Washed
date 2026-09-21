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
// 행은 다시 안 걸린다) 같은 사건에 경고가 두 번 붙지 않는다. Issue #8 이 이 스윕을
// 분 단위 스케줄러로 올리면서, 코드상의 그 성질에만 기대지 않고 **DB 가 직접**
// 막도록 사건 키를 더했다 — 0012 의 `warnings.incident_queue_id` 와 그 부분 UNIQUE
// 인덱스다. 한 queue 행이 곧 한 사건이고, 그 행은 배정 단계에서 만료되거나
// 수거 단계에서 만료되거나 둘 중 하나만 일어나므로(QR 인증을 하면 status 가 바뀌어
// 배정 만료 조건에 다시는 걸리지 않는다) 키 하나가 P6 의 "통합 1회" 를 그대로
// 표현한다. 관리자 쪽 교차 중복은 0008 의 `usage_history_id` 가 맡는다 —
// **단, 관리자의 자유 텍스트 경고(admin-actions.ts issueWarning)는 어느 사건에서
// 나왔는지 전혀 남기지 않아 여전히 교차 판별이 불가능하다.** 사건을 고르는 경로
// (issueUsageIncidentWarning)는 이미 구현돼 있으나 관리자 화면이 아직 부르지
// 않는다 — 그 연결은 별도 Issue 다.
// 05 P26 — 경고 발급은 푸시 허용 여부를 보지 않고, 알림은 항상 notify() 로
// 남긴다(허용하지 않은 사람도 알림함 기록은 그대로 생긴다 · notify.ts 의 원래 설계).

import 'server-only';

import { PICKUP_GRACE_MINUTES, RUN_MINUTES_BY_KIND } from '@/lib/assignment-rules';
import { sql } from '@/lib/db';
import { isFirstOfMonthInKst } from '@/lib/kst-date';
import { notify } from '@/lib/notify';
import { notifyUsageEnded } from '@/lib/usage-end-notify';
// 05 P6-1 — 자동 경고 사유 집합은 화면·서버가 함께 쓰는 warning-rules.ts 에 있다.
// 관리자 경고 쪽(admin-actions.ts)이 "이 사유는 사건을 골라야 한다" 를 판정할 때도
// 같은 집합을 보므로 여기 따로 적지 않는다.
import type { SystemWarningReason } from '@/lib/warning-rules';

/** 05 P7 — 제한이 걸리는 경고 횟수. admin-actions.ts 의 같은 상수와 값이 같아야 한다 */
const WARNING_LIMIT = 3;
/** 05 P7 — 제한 기간(일) */
const RESTRICT_DAYS = 3;

/** 05 P4 — usage_history 의 시작 시각을 ends_at 에서 거꾸로 되짚을 때 쓴다 (usage.ts 와 같은 기준) */
const WASHER_MINUTES = RUN_MINUTES_BY_KIND['세탁기'];
const DRYER_MINUTES = RUN_MINUTES_BY_KIND['건조기'];

const SYSTEM_WARNING_DESCRIPTION: Record<SystemWarningReason, string> = {
  '배정 후 미인증': '배정 후 10분 안에 QR 인증을 하지 않았어요',
  '수거 미완료': '수거 대기 후 3분 안에 다했어요를 누르지 않았어요',
};

/** 05 P6 — 경고 한 건이 나온 "사건". 중복 방지 키가 여기서 나온다 */
type WarningIncident = {
  /**
   * 이 경고를 낳은 줄서기 행(0012). 경고를 쓰는 시점엔 이미 지워진 행이지만,
   * uuid 값 자체가 그 사건의 이름으로 남는다.
   */
  queueId: string;
  /**
   * 05 P6 · 0008 — 강제 종료로 방금 만든 이용 내역. '배정 후 미인증'은 사용을
   * 시작한 적이 없어 usage_history 행 자체가 없으므로 넘기지 않는다.
   */
  usageHistoryId?: string;
};

/**
 * 23505 가 지정한 제약에서 났는지 — admin-actions.ts 의 isUniqueViolation() ·
 * queue/[kind]/route.ts 의 constraintOf() 와 같은 관용구다. admin-actions.ts 는
 * 'use server' 라 async 함수만 export 할 수 있어 그 구현을 가져다 쓸 수 없다
 * (WARNING_LIMIT 을 여기 따로 둔 것과 같은 이유).
 */
function isUniqueViolation(error: unknown, ...constraints: string[]): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; constraint?: string };
  return e.code === '23505' && constraints.includes(e.constraint ?? '');
}

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
 *
 * `incident` — 05 P6 · 0008 · 0012. 경고 INSERT 가 `incident_queue_id` 를 채우므로
 * **같은 줄서기 사건에는 경고가 하나뿐이다** — 스케줄러가 몇 번을 돌든, 두 tick 이
 * 겹치든 두 번째 INSERT 는 `warnings_incident_queue_id_idx` 에 23505 로 막힌다.
 * '수거 미완료'는 방금 만든 usage_history 행도 함께 넘겨(0008) 관리자의 사건 연결
 * 경고와도 겹치지 않게 한다. '배정 후 미인증'은 사용을 시작한 적이 없어
 * usage_history 가 없으므로 그 칸만 NULL 로 남는다.
 *
 * **한 문장으로 쓴다** — 예전에는 경고 INSERT · 누적 upsert · days_left 조회가 세
 * 문장이라, 중간에 끊기면 "경고는 쌓였는데 누적은 안 오른" 상태가 남을 수 있었다.
 * 이 저장소는 neon-http 라 BEGIN/COMMIT 을 쓸 수 없고 **한 문장이 곧 한 트랜잭션**
 * 이므로(db.ts · assignment.ts 머리말), 데이터 수정 CTE 로 묶어 둘을 전부 성공하거나
 * 전부 실패하게 만든다. days_left 도 upsert 의 RETURNING 에서 바로 받는다.
 *
 * @returns 경고를 실제로 매겼으면 true, 이미 그 사건에 경고가 있어 건너뛰었으면 false
 */
async function applySystemWarning(
  userId: string,
  reason: SystemWarningReason,
  now: Date,
  incident: WarningIncident,
): Promise<boolean> {
  const nowIso = now.toISOString();

  // try 밖에서 선언한다 — 아래 notify() 가 이 값을 쓰므로 try 안으로 줄일 수 없다.
  let applied: { days_left: number | null; issued_at: string }[];
  try {
    applied = await sql<{ days_left: number | null; issued_at: string }>`
      WITH warned AS (
        INSERT INTO warnings (user_id, reason, issued_by, usage_history_id, incident_queue_id)
        VALUES (${userId}, ${reason}, '시스템 자동',
                ${incident.usageHistoryId ?? null}, ${incident.queueId})
        RETURNING user_id, issued_at
      ),
      counted AS (
        INSERT INTO usage_restrictions (user_id, warning_count, restricted_from, restricted_until)
        SELECT w.user_id, 1,
               CASE WHEN ${WARNING_LIMIT}::int <= 1 THEN ${nowIso}::timestamptz ELSE NULL END,
               CASE WHEN ${WARNING_LIMIT}::int <= 1
                    THEN ${nowIso}::timestamptz + make_interval(days => ${RESTRICT_DAYS}::int)
                    ELSE NULL END
          FROM warned w
        ON CONFLICT (user_id) DO UPDATE SET
          warning_count = usage_restrictions.warning_count + 1,
          restricted_from = CASE
            WHEN usage_restrictions.warning_count + 1 >= ${WARNING_LIMIT}::int THEN ${nowIso}::timestamptz
            ELSE usage_restrictions.restricted_from END,
          restricted_until = CASE
            WHEN usage_restrictions.warning_count + 1 >= ${WARNING_LIMIT}::int
            THEN ${nowIso}::timestamptz + make_interval(days => ${RESTRICT_DAYS}::int)
            ELSE usage_restrictions.restricted_until END
        RETURNING restricted_until
      )
      SELECT CASE WHEN restricted_until IS NULL OR restricted_until <= ${nowIso}::timestamptz THEN NULL
                  ELSE CEIL(EXTRACT(EPOCH FROM (restricted_until - ${nowIso}::timestamptz)) / 86400)::int
             END AS days_left,
             -- Issue #65 — 알림함이 보여줄 「받은 시각」. 데이터 수정 CTE 는 몇 번을
             -- 참조해도 **한 번만** 실행되므로(counted 가 이미 warned 를 읽는다) 여기
             -- 한 줄이 경고 INSERT 를 더 만들지 않는다. 경고 한 건에 warned · counted
             -- 모두 한 행이라 CROSS JOIN 도 한 행이다.
             --
             -- 끝의 ::text 가 핵심이다. 이 저장소의 드라이버는 timestamptz(OID 1184)를
             -- pg-types 의 parseDate 로 **JS Date 에 담아** 주는데, Date 는 밀리초까지만
             -- 표현해 마이크로초가 잘린다 — 그대로 알림에 넣으면 알림함 시각이 경고
             -- 시각보다 미세하게 **앞선다**(실측 -621µs). 문자열로 받아 그대로 돌려보낸다.
             w.issued_at::text AS issued_at
        FROM counted
        CROSS JOIN warned w
    `;
  } catch (error) {
    // 05 P6 — 이 사건엔 이미 경고가 있다(자동이든 관리자든). 두 번 벌주지 않는 것이
    // 정상 동작이므로 조용히 넘어간다 — 누적도 오르지 않는다(같은 문장이라 함께 취소됐다).
    if (isUniqueViolation(error, 'warnings_incident_queue_id_idx', 'warnings_usage_history_id_idx')) {
      return false;
    }
    throw error;
  }

  const daysLeft = applied[0]?.days_left ?? null;
  // Issue #65 — 관리자 화면 · 이용기록이 보여주는 값과 **같은** issued_at 을 알림함에 넘긴다.
  const issuedAt = applied[0]?.issued_at;

  try {
    await notify(
      userId,
      '경고',
      '경고가 1회 누적됐어요',
      daysLeft
        ? `${SYSTEM_WARNING_DESCRIPTION[reason]} — 경고 ${WARNING_LIMIT}회가 되어 ${daysLeft}일 동안 줄서기를 할 수 없어요.`
        : `${SYSTEM_WARNING_DESCRIPTION[reason]} — 경고 ${WARNING_LIMIT}회가 되면 ${RESTRICT_DAYS}일 동안 줄서기를 할 수 없어요.`,
      { receivedAt: issuedAt },
    );
  } catch (error) {
    console.error('시스템 경고 알림 생성 실패', userId, reason, error);
  }

  return true;
}

/**
 * 05 P3 — 배정 후 10분 안에 QR 인증이 없으면 배정을 해제하고 경고 1회를 매긴다.
 *
 * **DELETE...RETURNING 한 문장으로 대상을 정한다** — 지운 행은 이 스윕이 두 번
 * 돌아도(스케줄러 · 줄서기 · 배치 어디서 겹쳐 불려도) 다시 걸리지 않는다
 * (05 P6 · idempotent). 06 「줄서기」의 「종료」는 저장되는 상태가 아니다 — 배정
 * 해제는 그 행을 지우는 것뿐이고, usage_history 에는 남기지 않는다(사용중을 시작한
 * 적이 없어 기록할 이용이 없다 · history/page.tsx 가 '배정 후 미인증'을 경고만으로
 * 표시하는 이유와 같다).
 *
 * 기기는 **배정을 준 뒤로 상태가 바뀌지 않았을 때만** 사용가능으로 되돌린다
 * (`status = '사용중'` 조건) — 관리자가 그새 고장으로 바꿔 놓았다면 덮어쓰지 않는다.
 * 이 기기 반환을 **DELETE 와 같은 문장에** 둔다(Issue #8) — 예전에는 queue 행을 전부
 * 지운 뒤 행마다 따로 UPDATE 했는데, 그 사이에 끊기면 queue 행은 없는데 기기는
 * `사용중` 인 채로 남아 drainQueue() 가 영영 집어가지 못하는 고아 기기가 됐다.
 * 하루 1회 배치일 때는 드문 일이었지만 분 단위 스케줄러에서는 상시 노출이다.
 *
 * 경고는 행마다 따로 매기되 **한 행의 실패가 나머지를 멈추지 않게** 감싼다 —
 * queue 행은 이미 지워진 뒤라, 여기서 예외가 위로 튀면 남은 사람들은 경고도 못 받고
 * 다시 걸리지도 않는다(assignment-notify.ts 가 알림에 같은 판단을 쓴다).
 */
export async function expireOverdueAssignments(now: Date = new Date()): Promise<number> {
  const expired = await sql<{ queue_id: string; user_id: string; machine_id: string }>`
    WITH expired AS (
      DELETE FROM queue
       WHERE status = '배정'
         AND assign_deadline_at IS NOT NULL
         AND assign_deadline_at <= ${now.toISOString()}::timestamptz
      RETURNING queue_id, user_id, machine_id
    ),
    freed AS (
      UPDATE machines m
         SET status = '사용가능', ends_at = NULL
        FROM expired e
       WHERE m.machine_id = e.machine_id
         AND m.status = '사용중'
      RETURNING m.machine_id
    )
    SELECT queue_id, user_id, machine_id FROM expired
  `;

  for (const row of expired) {
    try {
      await applySystemWarning(row.user_id, '배정 후 미인증', now, { queueId: row.queue_id });
    } catch (error) {
      console.error('배정 만료 경고 실패', row.user_id, row.queue_id, error);
    }
  }

  return expired.length;
}

/**
 * 05 P5 · F9 — 사용 타이머(machines.ends_at)가 끝난 사용중 줄을 수거대기로 옮긴다.
 *
 * **Issue #34 — 이 전환의 유일한 구현체다.** 예전에는 usage.ts::expireRunTimers()가
 * 거의 같은 SQL을 따로 갖고 있었지만(각자 훑는 구조), 정책이 두 곳에 있으면 한쪽만
 * 고쳐질 위험이 있어 이 함수 하나로 모았다. expireRunTimers()는 지금 이 함수를 그대로
 * 부르는 wrapper다(usage.ts 머리말 참고).
 *
 * `now` 는 **선택 인자다** — 두 호출부가 원래 쓰던 시각 기준이 서로 달랐고, 리팩터링이
 * 그 의미를 바꾸면 안 되므로 그대로 갈랐다.
 *   · 안 넘기면(`undefined`) SQL 의 `now()`(DB 서버 시각, UPDATE 실행 시점)를 쓴다 —
 *     expireRunTimers() 가 원래 쓰던 기준 그대로.
 *   · `Date` 를 넘기면 그 값을 쓴다 — transitionFinishedUsageToPickup() 이 원래 쓰던
 *     기준(호출 시점에 고정한 Node 서버 시각) 그대로.
 * 아래 `COALESCE(${...}::timestamptz, now())` 한 줄이 그 갈림을 SQL 문장 하나 안에서
 * 처리한다 — 조건마다 별도 SQL을 쓰지 않는다.
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
 * 이 한 문장의 `UPDATE ... RETURNING`이 유일한 쓰기라 두 호출(GET /api/queue 폴링 ·
 * POST /api/queue/[kind] · cleanup 배치)이 겹쳐도 Postgres가 같은 행의 UPDATE를
 * 직렬화한다 — 뒤 호출은 앞 호출이 이미 바꾼 행을 조건 불일치로 0행만 본다.
 *
 * 05 P26 · Issue #12 — 전환된 행마다(RETURNING된 행에만) "이용 시간이 끝났어요"
 * 알림을 준다(usage-end-notify.ts). 알림 호출이 이 함수 안 한 곳에만 있으므로 같은
 * 행에 알림이 두 번 붙을 수 없다.
 */
export async function transitionUsageToPickup(
  now?: Date,
): Promise<{ queue_id: string; user_id: string; machine_name: string }[]> {
  const nowOverride = now ? now.toISOString() : null;

  const started = await sql<{ queue_id: string; user_id: string; machine_name: string }>`
    UPDATE queue q
       SET status = '수거대기',
           pickup_deadline_at = m.ends_at
             + (${PICKUP_GRACE_MINUTES}::int * interval '1 minute')
      FROM machines m
     WHERE q.machine_id = m.machine_id
       AND q.status = '사용중'
       AND m.status = '사용중'
       AND m.ends_at IS NOT NULL
       AND m.ends_at <= COALESCE(${nowOverride}::timestamptz, now())
    RETURNING q.queue_id, q.user_id, m.name AS machine_name
  `;

  for (const row of started) {
    await notifyUsageEnded(row.user_id, row.queue_id, row.machine_name);
  }

  return started;
}

/** POST /api/queue/[kind] · cleanup.ts 가 쓰는 얇은 wrapper — 전환 건수만 필요하다. */
export async function transitionFinishedUsageToPickup(now: Date = new Date()): Promise<number> {
  const started = await transitionUsageToPickup(now);
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
 *
 * **지우기 · 기기 반환 · 이용 내역을 한 문장에 묶는다**(Issue #8) —
 * expireOverdueAssignments() 와 같은 이유다. 예전에는 queue 행을 먼저 전부 지운 뒤
 * 행마다 UPDATE · INSERT 를 이어 했는데, 그 사이에 끊기면 queue 행도 이용 내역도
 * 없는데 기기만 `사용중` 으로 남는 고아 상태가 됐다. 시작 시각 계산은 예전 JS 식을
 * 그대로 SQL 로 옮긴 것이다(ends_at 이 없을 때의 방어적 대체값 포함). 기기 종류
 * CASE 는 usage.ts 의 `started` CTE 와 같은 관용구다 — machines.kind 에 CHECK 가
 * 있어 두 값 말고는 올 수 없다.
 */
export async function expireOverduePickups(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();

  const expired = await sql<{
    queue_id: string;
    user_id: string;
    history_id: string | null;
  }>`
    WITH expired AS (
      DELETE FROM queue q
        USING machines m
       WHERE q.machine_id = m.machine_id
         AND q.status = '수거대기'
         AND q.pickup_deadline_at IS NOT NULL
         AND q.pickup_deadline_at <= ${nowIso}::timestamptz
      RETURNING q.queue_id, q.user_id, q.machine_id, m.kind AS machine_kind,
                m.ends_at, q.pickup_deadline_at
    ),
    freed AS (
      UPDATE machines m
         SET status = '사용가능', ends_at = NULL
        FROM expired e
       WHERE m.machine_id = e.machine_id
         AND m.status = '사용중'
      RETURNING m.machine_id
    ),
    logged AS (
      -- 05 P6 · 0013 — source_queue_id 로 원래 줄서기 사건을 남긴다(usage.ts 의
      -- finishUsage 와 같은 이유). 이 값이 있어야 만료 뒤에도 관리자 경고가 같은
      -- canonical 사건 키(warnings.incident_queue_id)를 향한다.
      INSERT INTO usage_history (user_id, machine_id, started_at, ended_at, result, source_queue_id)
      SELECT e.user_id, e.machine_id,
             -- ends_at 은 transitionUsageToPickup() 이 이 값을 근거로 pickup_deadline_at
             -- 을 찍었으므로 항상 있어야 한다 — 없을 때만 마감에서 유예를 되짚는다.
             COALESCE(e.ends_at,
                      e.pickup_deadline_at - (${PICKUP_GRACE_MINUTES}::int * interval '1 minute'))
               - (CASE e.machine_kind WHEN '세탁기' THEN ${WASHER_MINUTES}::int
                                      ELSE ${DRYER_MINUTES}::int END * interval '1 minute'),
             e.pickup_deadline_at,
             '경고',
             e.queue_id
        FROM expired e
      RETURNING history_id, machine_id
    )
    SELECT e.queue_id, e.user_id, l.history_id
      FROM expired e
      -- 기기 하나에 줄서기 행은 최대 하나다(queue_machine_once_idx) — 이 배치 안에서
      -- machine_id 가 곧 행의 키라 이용 내역을 안전하게 되짚을 수 있다.
      LEFT JOIN logged l ON l.machine_id = e.machine_id
  `;

  for (const row of expired) {
    try {
      // 05 P6 — 줄서기 행(0012)과 이용 내역(0008)을 둘 다 사건 참조로 남긴다.
      // 관리자가 F28에서 같은 이용 내역을 골라 경고를 또 주려 하면
      // warnings_usage_history_id_idx 가 막는다.
      await applySystemWarning(row.user_id, '수거 미완료', now, {
        queueId: row.queue_id,
        usageHistoryId: row.history_id ?? undefined,
      });
    } catch (error) {
      console.error('수거 만료 경고 실패', row.user_id, row.queue_id, error);
    }
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
