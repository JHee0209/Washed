// F8 — QR 인증 성공 뒤 "배정 → 사용중" 전환 (05 P3 · P4 · R8 · 08 · 6번 · Issue #6).
//
// assignment.ts 의 drainQueue() 가 "기기 여러 대 × 대기자 여러 명"을 한꺼번에 짝짓는
// 문제라 FOR UPDATE + MATERIALIZED CTE 가 필요했던 것과 달리, 여기는 **정확히 한
// 사용자 · 한 기기의 상태 전환**이다 — api/queue/[kind]/route.ts 의 DELETE(줄 빠지기)가
// 쓰는 "조건부 UPDATE 가 0행이면 진 것" 관용구로 충분하다.
//
// 한 문장(=한 트랜잭션, src/lib/db.ts 머리말)으로 아래를 전부 검사·전환한다:
//   · 내 배정인가            — WHERE user_id = $userId
//   · 그 기기가 맞는가        — WHERE machine_id = $machineId
//   · 아직 배정 상태인가      — WHERE status = '배정'
//   · 10분이 지나지 않았는가  — WHERE assign_deadline_at > now() (서버 시각)
// 넷 중 하나라도 어긋나면 0행이라 아무것도 바뀌지 않는다.
//
// **idempotent 처리(8번·9번 요구사항)** — 이미 `사용중`으로 바뀐 내 배정을 다시
// 스캔해도(카메라가 QR을 계속 보거나, 같은 요청이 동시에 두 번 들어와도) 성공으로
// 응답하되 `machines.ends_at`은 다시 건드리지 않는다. `claimed`(새로 전환)와
// `already_running`(이미 사용중)은 이 문장이 시작될 때의 **같은 스냅샷**을 보므로
// 서로 겹치지 않는다 — 한 행이 그 순간에 동시에 '배정'이면서 '사용중'일 수는 없다
// (assignment.ts 머리말 — "CTE 끼리는 서로의 표 변경을 보지 못하고 값으로만
// 주고받는다"). 동시에 두 요청이 들어오면 Postgres 가 같은 행의 UPDATE 를
// 직렬화하므로, 뒤 요청은 앞 요청이 커밋한 뒤 새 스냅샷에서 `already_running` 으로
// 잡혀 타이머를 다시 늘리지 않는다.

import 'server-only';
import { sql } from '@/lib/db';
import { RUN_MINUTES_BY_KIND } from '@/lib/assignment-rules';
import { notifyUsageEnded } from '@/lib/usage-end-notify';

const WASHER_MINUTES = RUN_MINUTES_BY_KIND['세탁기'];
const DRYER_MINUTES = RUN_MINUTES_BY_KIND['건조기'];

/** db/schema.sql 의 machine_id 는 uuid 다 — 질의에 넣기 전에 모양만 본다 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StartUsageResult =
  | {
      ok: true;
      queueId: string;
      machineId: string;
      machineKind: string;
      machineName: string | null;
      endsAt: string;
      serverNow: string;
    }
  | {
      ok: false;
      /** 다른 사람 소유거나 다른 기기라 내 배정을 찾지 못함 */
      reason: 'not_assigned';
    }
  | {
      ok: false;
      /**
       * 서명은 맞지만 그 machine_id 가 machines 에 없다 — 기기를 지운 뒤에도 남아
       * 있는 스티커거나, `npm run qr:print` 에 잘못된 id 를 넣어 뽑은 QR 이다
       * (Issue #30 「존재하지 않는 machine_id · DB 에 없는 기기는 거부」).
       */
      reason: 'unknown_machine';
    }
  | {
      ok: false;
      /** 이 기기는 다른 사용자에게 배정돼 있음 — 05 P3 「다른 사람 QR 인증 불가」 */
      reason: 'other_user';
    }
  | {
      ok: false;
      /** 배정은 맞지만 10분(assign_deadline_at)이 지남 — 05 P3 */
      reason: 'expired';
    };

/**
 * QR 검증(서명·위조 여부는 src/lib/qr.ts 가 이미 확인했다)을 통과한 뒤 실제로
 * "배정 → 사용중"을 전환하고 기기 종료 예정 시각을 서버가 정한다(05 P4 — 세탁 60분 ·
 * 건조 45분. 클라이언트가 계산해 보내는 값을 쓰지 않는다).
 */
export async function startUsageFromQr({
  userId,
  machineId,
}: {
  userId: string;
  machineId: string;
}): Promise<StartUsageResult> {
  // machines.machine_id 는 uuid 다. 서명은 맞지만 uuid 가 아닌 값이 담긴 QR(예:
  // `npm run qr:print washer-1` 로 잘못 뽑아 붙인 스티커)을 그대로 질의에 넘기면
  // Postgres 가 22P02 로 죽어 호출부가 500 을 돌려준다 — 「거부」가 아니라 「장애」로
  // 보인다. 모양부터 걸러 다른 잘못된 QR 과 같은 자리로 보낸다 (Issue #30).
  if (!UUID_SHAPE.test(machineId)) {
    return { ok: false, reason: 'unknown_machine' };
  }

  const rows = await sql<{
    queue_id: string;
    machine_kind: string;
    machine_name: string | null;
    ends_at: string;
    server_now: string;
  }>`
    WITH
    -- 새로 전환: 내 배정이 맞고, 아직 「배정」이고, 10분 안이면 「사용중」으로 바꾼다.
    claimed AS (
      UPDATE queue q
         SET status = '사용중'
       WHERE q.user_id = ${userId}
         AND q.machine_id = ${machineId}
         AND q.status = '배정'
         AND q.assign_deadline_at > now()
      RETURNING q.queue_id, q.machine_kind, q.machine_id, true AS fresh
    ),
    -- idempotent 경로: 이미 내가 이 기기를 사용중이면 그대로 성공으로 본다.
    -- (이 문장이 시작될 때의 스냅샷 기준이라 claimed 와 겹치지 않는다 — 위 머리말)
    already_running AS (
      SELECT q.queue_id, q.machine_kind, q.machine_id, false AS fresh
        FROM queue q
       WHERE q.user_id = ${userId}
         AND q.machine_id = ${machineId}
         AND q.status = '사용중'
    ),
    target AS (
      SELECT * FROM claimed
      UNION ALL
      SELECT * FROM already_running
    ),
    -- 새로 전환된 경우에만 타이머를 세운다 — idempotent 재호출은 다시 늘리지 않는다
    -- (8번 요구사항: "사용 시작 시간이 계속 갱신되지 않도록").
    --
    -- status 도 여기서 함께 못 박는다. 보통은 assignment.ts::drainQueue() 가 배정할
    -- 때 이미 「사용중」 으로 바꿔 두므로 값이 달라지지 않지만(그래서 이 줄이 평소에는
    -- 아무것도 하지 않는다), 그 말은 **이 기기가 지금 사용중이라는 사실을 QR 인증이
    -- 아니라 앞 단계가 기억하고 있다**는 뜻이기도 하다. queue 는 「사용중」 인데
    -- machines 는 「사용가능」 인 조합이 한 번이라도 생기면 홈 기기 목록(F1)과
    -- queries.ts::queueCounts() 가 그 기기를 빈 기기로 세어 화면과 DB 가 어긋난다
    -- (Issue #30 완료 조건 「QR 인증 결과와 홈 UI 상태가 일치한다」). 사용 시작을
    -- 확정하는 이 자리에서 같이 쓰면 그 조합 자체가 남지 않는다.
    started AS (
      UPDATE machines m
         SET status = '사용중',
             ends_at = now() + (
               CASE t.machine_kind
                 WHEN '세탁기' THEN ${WASHER_MINUTES}::int
                 ELSE ${DRYER_MINUTES}::int
               END * interval '1 minute'
             )
        FROM target t
       WHERE m.machine_id = t.machine_id
         AND t.fresh
      RETURNING m.machine_id, m.ends_at, m.name
    )
    SELECT t.queue_id, t.machine_kind,
           COALESCE(s.name, m.name) AS machine_name,
           COALESCE(s.ends_at, m.ends_at) AS ends_at,
           now() AS server_now
      FROM target t
      LEFT JOIN started  s ON s.machine_id = t.machine_id
      LEFT JOIN machines m ON m.machine_id = t.machine_id
  `;

  const row = rows[0];
  if (row) {
    return {
      ok: true,
      queueId: row.queue_id,
      machineId,
      machineKind: row.machine_kind,
      machineName: row.machine_name,
      endsAt: row.ends_at,
      serverNow: row.server_now,
    };
  }

  // 실패 원인을 가려서 알려준다 — 위 판정은 이미 끝났으므로 잠금 없는 조회로 충분하다.
  const reasonRows = await sql<{ user_id: string; status: string; assign_deadline_at: string | null }>`
    SELECT user_id, status, assign_deadline_at FROM queue WHERE machine_id = ${machineId}
  `;
  const existing = reasonRows[0];
  if (!existing) {
    // 줄이 안 붙은 기기다. 「아직 배정되지 않은 기기」와 「DB 에 아예 없는 기기」는
    // 사용자가 할 수 있는 일이 다르다 — 앞은 배정을 기다리면 되고, 뒤는 스티커가
    // 잘못된 것이라 관리자가 QR 을 다시 붙여야 한다 (Issue #30).
    const machineRows = await sql<{ machine_id: string }>`
      SELECT machine_id FROM machines WHERE machine_id = ${machineId}
    `;
    if (machineRows.length === 0) {
      return { ok: false, reason: 'unknown_machine' };
    }
    return { ok: false, reason: 'not_assigned' };
  }
  if (existing.user_id !== userId) {
    // 05 P3 · 10번 — 다른 사용자가 다른 사람 배정 QR을 인증할 수 없다.
    return { ok: false, reason: 'other_user' };
  }
  // 내 배정이 맞는데 실패했다면 남은 경우는 하나뿐이다 — 10분 초과(05 P3).
  return { ok: false, reason: 'expired' };
}

// F9 — 사용 타이머 종료 처리 (05 P5 · P13 · P26 · 08 · 4번 · Issue #7 · #12).
//
// **알림 발송은 usage-end-notify.ts 에 맡긴다.** "이용 시간이 끝났어요" 푸시(Issue
// #12 · R38)는 이 파일도 expiration.ts(Issue #8)도 아닌 중립 모듈을 부른다 — #7과
// #8이 같은 전환을 각자 훑으면서(아래 주석) 서로를 import하면 순환 참조가 되므로,
// 둘 다 usage-end-notify.ts 하나만 바라본다. 전환 조건(WHERE) 자체는 그대로다 —
// 알림은 "이미 확정된 전환"에 얹을 뿐 언제·누가 전환되는지를 바꾸지 않는다.
//
// 특정 사용자에 묶이지 않은 전역 함수다 — `myQueue(userId)` 안에 CTE로 넣으면 그
// 사용자가 홈 화면을 열어 폴링할 때만 전환이 일어나 관리자 대기열(adminQueue())이
// 낡은 `사용중`을 계속 보여준다. 그래서 이 함수를 조회 경로 여럿(홈 · 관리자)이
// 각자 자기 SELECT 앞에서 부른다 — 같은 이유로 `queries.ts::myQueue()`의 SQL 자체는
// 바꾸지 않는다.
//
// 여러 행을 매만지지만 행끼리 서로 경합하지 않는다(각 행의 자격은 `상태 = 사용중
// AND 그 기기의 ends_at이 지났는가` 뿐이라 `assignment.ts`의 기기×대기자 짝짓기 같은
// 교차 조건이 없다) — 그래서 `FOR UPDATE`·`MATERIALIZED` 없이도 UPDATE 한 문장이면
// 충분하다. 이미 전환된 행은 `상태 = 사용중` 조건에 걸려 다시 잡히지 않으므로
// idempotent 하다(여러 조회가 동시에 불러도 안전하다).
//
// **같은 전환이 expiration.ts::transitionFinishedUsageToPickup() 에도 있다**(08 ·
// 4번 · Issue #8) — 그쪽은 줄서기 POST 때와 하루 1회 배치에서만 돈다. 이 함수는
// 홈 화면 폴링(GET /api/queue)마다 돌아 실제로는 이쪽이 거의 항상 먼저 그 행을
// 잡는다. 같은 `상태 = 사용중` 가드를 쓰므로 어느 쪽이 먼저 잡아도 한 행은 한 번만
// 전환되고, RETURNING된 쪽만 알린다 — usage-end-notify.ts 머리말 참고.
export async function expireRunTimers(): Promise<void> {
  const started = await sql<{ queue_id: string; user_id: string; machine_name: string }>`
    UPDATE queue q
       SET status = '수거대기',
           pickup_deadline_at = m.ends_at + interval '3 minutes'
      FROM machines m
     WHERE q.machine_id = m.machine_id
       AND q.status = '사용중'
       AND m.ends_at <= now()
    RETURNING q.queue_id, q.user_id, m.name AS machine_name
  `;

  for (const row of started) {
    await notifyUsageEnded(row.user_id, row.queue_id, row.machine_name);
  }
}

// F10 — "다했어요" (05 P5 · P6 · 08 · 4번 · Issue #7).
//
// 남은 시간과 관계없이(이용 중이든 수거대기든) 그 자리에서 종료한다. 경고 판정은
// 여기서 하지 않는다 — 수거 3분 초과의 강제 종료 · 경고 부여는 `assignment.ts`
// 머리말이 명시적으로 Issue #8(서버 스케줄러)의 몫으로 남겨 둔 자리다. 이 함수가
// 불릴 때는 항상 사용자가 직접 누른 정상 종료이므로 결과는 늘 '완료'다.
export type FinishUsageResult =
  | {
      ok: true;
      queueId: string;
      machineId: string;
      machineKind: string;
      serverNow: string;
    }
  | {
      ok: false;
      /** 그 기기에 걸린 내 줄 자체가 없음(이미 끝났거나 애초에 없음) */
      reason: 'not_in_use';
    }
  | {
      ok: false;
      /** 다른 사용자가 쓰고 있는 기기 */
      reason: 'other_user';
    }
  | {
      ok: false;
      /** 내 줄은 맞지만 아직 '배정'(QR 미인증) 상태 */
      reason: 'not_started';
    };

export async function finishUsage({
  userId,
  machineId,
}: {
  userId: string;
  machineId: string;
}): Promise<FinishUsageResult> {
  // `removed`(DELETE의 RETURNING)에서만 파생시킨다 — 앞서 조회한 스냅샷에서
  // 파생시키면 중복 클릭이나 관리자의 cancelQueue · setMachineStatus와 겹칠 때
  // 진 쪽이 이미 없어진 기기를 다시 '사용가능'으로 바꾸거나 usage_history를
  // 중복 기록할 수 있다(0행이면 아무 것도 하지 않는 것이 DELETE 자체가 보장한다).
  const rows = await sql<{
    queue_id: string;
    machine_id: string;
    machine_kind: string;
    server_now: string;
  }>`
    WITH
    removed AS (
      DELETE FROM queue q
       USING machines m
       WHERE q.machine_id = m.machine_id
         AND q.user_id    = ${userId}
         AND q.machine_id = ${machineId}
         AND q.status IN ('사용중', '수거대기')
      RETURNING q.queue_id, q.machine_id, q.machine_kind, m.ends_at
    ),
    freed AS (
      UPDATE machines m
         SET status = '사용가능', ends_at = NULL
        FROM removed r
       WHERE m.machine_id = r.machine_id
      RETURNING m.machine_id
    ),
    logged AS (
      INSERT INTO usage_history (user_id, machine_id, started_at, ended_at, result)
      SELECT ${userId}, r.machine_id,
             r.ends_at - (
               CASE r.machine_kind
                 WHEN '세탁기' THEN ${WASHER_MINUTES}::int
                 ELSE ${DRYER_MINUTES}::int
               END * interval '1 minute'
             ),
             now(), '완료'
        FROM removed r
      RETURNING history_id
    )
    SELECT r.queue_id, r.machine_id, r.machine_kind, now() AS server_now
      FROM removed r
  `;

  const row = rows[0];
  if (row) {
    return {
      ok: true,
      queueId: row.queue_id,
      machineId: row.machine_id,
      machineKind: row.machine_kind,
      serverNow: row.server_now,
    };
  }

  // 실패 원인을 가려서 알려준다 — startUsageFromQr과 같은 패턴.
  const existingRows = await sql<{ user_id: string; status: string }>`
    SELECT user_id, status FROM queue WHERE machine_id = ${machineId}
  `;
  const existing = existingRows[0];
  if (!existing) {
    return { ok: false, reason: 'not_in_use' };
  }
  if (existing.user_id !== userId) {
    return { ok: false, reason: 'other_user' };
  }
  // 내 줄인데 실패했다면 남은 경우는 아직 '배정'(QR 미인증) 뿐이다.
  return { ok: false, reason: 'not_started' };
}
