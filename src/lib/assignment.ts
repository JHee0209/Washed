// 배정 — 서버가 정하고 클라이언트는 결과만 받는다 (F5 · F6 · 05 P2 · P3 · 08 · 3번).
//
// 08 · 3번이 적어 둔 구멍이 이 파일이 메우는 자리다:
//   「지금은 각 브라우저의 _reconcile() 이 "내가 보기에 다음 차례" 를 스스로 판단한다.
//    사용자가 둘 이상이면 **같은 기기에 두 명이 배정될 수 있다.**」
//
// 판정 규칙(누가 어느 기기를 받는가)은 src/lib/assignment-rules.ts 에 순수 함수로
// 있고, 여기는 **그 규칙을 동시에 여러 요청이 들어와도 안전하게 쓰는 SQL** 이다.
//
// ── 왜 한 문장인가
// src/lib/db.ts 의 neon 드라이버는 여러 쿼리에 걸친 명시적 BEGIN/COMMIT 을 지원하지
// 않는다(admin-actions.ts 의 addNotice · api/reports/route.ts 가 같은 이유로 CTE 한
// 문장을 쓴다). 그런데 **한 문장이 곧 한 트랜잭션**이라, 문장 안에서 잡은 행 잠금은
// 문장이 끝날 때까지 산다 — 배정에 필요한 창이 정확히 그 길이다.
//
// ── 왜 FOR UPDATE 인가 (조건부 UPDATE 만으로는 모자란다)
// setReportStatus 가 쓰는 「조건부 UPDATE 가 0행이면 진 것」 관용구는 **한 행을 놓고
// 다투는** 경우에만 충분하다. 배정은 「기기 여러 대 × 대기자 여러 명」을 한꺼번에
// 짝짓는 일이라, 스냅샷만 믿으면 두 요청이 **같은 대기자에게 서로 다른 기기**를
// 물려 한 대가 주인 없이 `사용중` 으로 남는 경로가 열린다.
// READ COMMITTED 에서 `FOR UPDATE` 는 잠금 대기에 걸렸다 깨어날 때 WHERE 를 **최신
// 버전으로 다시 본다** — 그래서 다른 요청이 방금 가져간 기기는 짝짓기 **전에**
// 목록에서 빠진다. 낡은 스냅샷으로 짝을 짓지 않게 하는 것이 이 잠금의 목적이다.
//
// ── 언제 부르나 (GET 안에서는 부르지 않는다)
// 「빈 기기 × 대기자」가 바뀌는 자리에서만 부른다 — 줄서기(api/queue/[kind]) ·
// 관리자의 대기열 빼기와 강제 사용가능(admin-actions.ts). 조회 라우트에서 부르면
// 폴링마다 쓰기가 나가고, 배정이 실패했을 때 순수한 조회까지 500 으로 떨어진다.
// 배정 10분 만료 · 수거 3분 · 주기 스케줄러는 여기가 아니라 08 · 4번(Issue #8)이다.

import 'server-only';
import { sql } from '@/lib/db';
import { ASSIGN_WINDOW_MINUTES } from '@/lib/assignment-rules';

export { ASSIGN_WINDOW_MINUTES };

/** drainQueue() 가 실제로 올린 배정 한 건 */
export type Assignment = {
  queue_id: string;
  user_id: string;
  machine_kind: string;
  machine_id: string;
  machine_name: string;
  /** 06 「배정 시각」 — 기기가 사용가능이 된 서버 시각이다 (05 상태값 · 08 · 4번) */
  assigned_at: string;
  /** 06 「배정 마감 시각(배정 시각 + 10분)」 · 05 P3 */
  assign_deadline_at: string;
};

/**
 * 지금 비어 있는 기기를 줄 선 순서대로 대기자에게 배정한다 (05 P2 · P3).
 *
 * 할 일이 없으면 빈 배열을 돌려주고 끝난다 — 아무 데서나 불러도 싸다.
 * 여러 요청이 동시에 불러도 **같은 machine_id 가 두 줄에 붙지 않는다**:
 *
 *   1) `FOR UPDATE`            — 낡은 스냅샷으로 짝을 짓지 않는다 (위 머리말)
 *   2) `queue_machine_once_idx` — DB 의 마지막 방어선 (db/schema.sql 3번)
 *   3) 순서: queue 를 먼저 쓰고 machines 를 뒤에 쓴다 — 아래 주석 참고
 */
export async function drainQueue(): Promise<Assignment[]> {
  return sql<Assignment>`
    WITH
    -- 1) 지금 배정할 수 있는 기기.
    --
    --    05 P10 · P20 — 고장 · 점검중 · 사용중은 여기서 빠진다(= 배정 대상이 아니다).
    --    앞사람이 수거대기(05 P5)인 기기도 아직 「사용중」 이라 빠진다 — **그래서
    --    앞사람의 3분이 다음 사람의 10분에 들어가지 않는다**(08 · 4번).
    --
    --    NOT EXISTS 는 없어도 되는 줄처럼 보이지만 아니다. 관리자가 배정된 기기를
    --    「사용가능」 으로 되돌려 놓으면(setMachineStatus) 그 기기를 가리키는 queue
    --    행이 살아 있는 채로 남는데, 이 줄이 없으면 아래 UPDATE 가
    --    queue_machine_once_idx 에 걸려 **배정 전체가 매 요청 23505 로 죽는다**.
    --
    --    윈도 함수와 FOR UPDATE 는 같은 SELECT 에 쓸 수 없어 층을 나눈다.
    --    MATERIALIZED 를 붙여 잠금이 여기서 한 번에 일어나게 한다.
    locked_free AS MATERIALIZED (
      SELECT m.machine_id, m.kind, m.name
        FROM machines m
       WHERE m.status = '사용가능'
         AND NOT EXISTS (SELECT 1 FROM queue q WHERE q.machine_id = m.machine_id)
       ORDER BY m.kind, m.name
         FOR UPDATE
    ),
    -- 2) 줄 선 순서 (05 P2 · P8). 같은 이유로 FOR UPDATE — 줄 빠지기 DELETE 와
    --    다른 배정 요청이 여기서 정렬된다. 잠그지 않으면 「기기는 사용중으로
    --    바뀌었는데 붙일 줄이 방금 삭제된」 고아가 생긴다.
    locked_waiting AS MATERIALIZED (
      SELECT q.queue_id, q.user_id, q.machine_kind, q.queued_at
        FROM queue q
       WHERE q.status = '대기 중'
         -- 05 P20 · 06 「세탁실」 · Issue #47 — 점검 중에는 새로 배정하지 않는다.
         -- 이미 배정 · 사용중인 줄은 status 가 '대기 중'이 아니므로 이 WHERE 에
         -- 애초에 걸리지 않는다 — 그래서 점검을 켜도 그 줄들은 그대로 진행된다
         -- (P20 그대로). 점검 시작 이전에 이미 대기 중이던 사람도 여기서 함께
         -- 멈춘다 — 배정은 "새 줄서기"가 아니라 "기기를 새로 잡는 일"이라 점검의
         -- 목적(전수 점검)과 충돌하기 때문이다. 점검을 끄면 이 WHERE 가 다시
         -- 통과해 대기 순서 그대로 배정이 재개된다.
         AND NOT EXISTS (
           SELECT 1 FROM facility_status WHERE id = true AND is_under_inspection
         )
       ORDER BY q.machine_kind, q.queued_at, q.queue_id
         FOR UPDATE
    ),
    -- 3) 짝짓기 — src/lib/assignment-rules.ts 의 pairWaitersWithMachines() 와
    --    **같은 규칙**이다(종류별로 갈라 k번째 대기자에게 k번째 기기). 호기를 고를
    --    수 없으므로(05 P2) 같은 종류의 빈 기기는 서로 구별되지 않는다.
    --    「가장 먼저 끝나는 기기」는 이 ORDER BY 가 아니라 **먼저 끝난 기기가 먼저
    --    사용가능이 된다**는 사실이 지킨다 — 여기 오는 기기는 이미 전부 비어 있다.
    free AS (
      SELECT machine_id, kind, name,
             row_number() OVER (PARTITION BY kind ORDER BY name) AS rn
        FROM locked_free
    ),
    waiting AS (
      SELECT queue_id, user_id, machine_kind,
             row_number() OVER (PARTITION BY machine_kind ORDER BY queued_at, queue_id) AS rn
        FROM locked_waiting
    ),
    pairs AS (
      SELECT w.queue_id, w.user_id, w.machine_kind, f.machine_id, f.name AS machine_name
        FROM waiting w
        JOIN free f ON f.kind = w.machine_kind AND f.rn = w.rn
    ),
    -- 4) **줄서기를 먼저 쓴다.** 두 UPDATE 의 순서는 위의 잠금 덕에 정합성에는
    --    영향이 없지만, 어긋났을 때가 다르다 — 줄이 먼저면 줄이 안 붙었을 때 기기를
    --    태우지 않는다(주인 없는 「사용중」 이 생기지 않는다).
    --
    --    assigned_at · assign_deadline_at 은 **서버 시각 now() 로만** 찍는다.
    --    클라이언트가 보낸 시각을 쓰지 않는다 (08 · 4번).
    assigned AS (
      UPDATE queue q
         SET machine_id         = p.machine_id,
             status             = '배정',
             assigned_at        = now(),
             assign_deadline_at = now() + (${ASSIGN_WINDOW_MINUTES}::int * interval '1 minute')
        FROM pairs p
       WHERE q.queue_id = p.queue_id
         AND q.status   = '대기 중'
      RETURNING q.queue_id, q.user_id, q.machine_kind, q.machine_id,
                q.assigned_at, q.assign_deadline_at
    ),
    -- 5) 기기는 **실제로 배정된 줄에 대해서만** 잡는다. assigned 의 RETURNING 을
    --    읽으므로 assigned 가 먼저 끝난다(CTE 끼리는 서로의 표 변경을 보지 못하고
    --    값으로만 주고받는다). ends_at 은 비워 둔다 — 타이머는 QR 인증에서 돈다
    --    (05 P4 · Issue #6). 그래서 배정 상태의 기기는 「사용중」 + 종료 예정 없음이다.
    claimed AS (
      UPDATE machines m
         SET status = '사용중', ends_at = NULL
        FROM assigned a
       WHERE m.machine_id = a.machine_id
         AND m.status     = '사용가능'
      RETURNING m.machine_id
    )
    -- claimed 를 아래에서 읽지 않지만 **반드시 실행된다** — WITH 안의 쓰기 문장은
    -- 바깥 질의가 그 결과를 읽든 말든 한 번, 끝까지 돈다(Postgres 의 정의다).
    -- 결과에서 걸러내지도 않는다: 사용자에게 「내 상태」는 queue 행이고, 그 행이
    -- 이미 「배정」 이 됐다면 그대로 알려주는 쪽이 맞다.
    SELECT a.queue_id, a.user_id, a.machine_kind, a.machine_id,
           p.machine_name, a.assigned_at, a.assign_deadline_at
      FROM assigned a
      JOIN pairs p ON p.queue_id = a.queue_id
  `;
}
