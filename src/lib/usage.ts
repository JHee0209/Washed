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

const WASHER_MINUTES = RUN_MINUTES_BY_KIND['세탁기'];
const DRYER_MINUTES = RUN_MINUTES_BY_KIND['건조기'];

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
    started AS (
      UPDATE machines m
         SET ends_at = now() + (
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
    return { ok: false, reason: 'not_assigned' };
  }
  if (existing.user_id !== userId) {
    // 05 P3 · 10번 — 다른 사용자가 다른 사람 배정 QR을 인증할 수 없다.
    return { ok: false, reason: 'other_user' };
  }
  // 내 배정이 맞는데 실패했다면 남은 경우는 하나뿐이다 — 10분 초과(05 P3).
  return { ok: false, reason: 'expired' };
}
