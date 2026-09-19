-- 0012 — 경고의 "사건" 을 줄서기 행으로 못박는다 (05 P6 · Issue #8).
--
-- 근거: 05 P6 「"다했어요" 미클릭과 세탁물 미수거가 함께 일어나도 중복 부과하지
-- 않고 통합 1회만 부여한다」· 08 · 4번 「경고는 한 번만 쌓는다」. Issue #8 이
-- 만료 판정을 서버 스케줄러로 옮기면서, 같은 스윕이 분 단위로 계속 돌고 재시도도
-- 되므로 "같은 사건에 경고 1회" 를 **DB 가 물리적으로** 보장해야 한다.
--
-- 0008 이 이미 usage_history_id 를 사건 참조로 두었지만 그것만으로는 모자란다:
--   · P3(배정 후 미인증)은 사용을 시작한 적이 없어 usage_history 행이 아예 없다.
--     0008 의 머리말이 그래서 이 칸을 "P3까지 억지로 채우게 만들지 않는다" 고 적었다.
--   · 그 결과 P3 자동 경고에는 지금 DB 레벨 중복 방지가 하나도 없다 —
--     expireOverdueAssignments() 의 DELETE...RETURNING 이라는 **코드상의** 성질에만
--     기대고 있었다.
--
-- queue_id 를 쓰는 이유 — 한 queue 행이 곧 한 줄서기 사건이다(대기 중 → 배정 →
-- 사용중 → 수거대기). 그리고 한 행은 **배정 단계에서 만료되거나(배정 후 미인증)
-- 수거 단계에서 만료되거나(수거 미완료) 둘 중 하나만** 일어난다 — QR 인증을 하는
-- 순간 status 가 '사용중' 으로 바뀌어 배정 만료 조건(status='배정')에 영원히 걸리지
-- 않기 때문이다 — queue.status 를 바꾸는 곳은 assignment.ts · usage.ts · expiration.ts
-- 셋뿐이고 전부 한 방향 전환이라, 되돌아오는 경로가 없다. 그래서 이 칸에 걸린 부분
-- UNIQUE 하나가 두 사유를 합쳐 **시스템 자동 경고**를 사건당 1회로 못박는다.
--
-- **이 칸만으로 05 P6 이 다 닫히지는 않는다.** 관리자가 「사용자 목록」(F29)에서 주는
-- 자유 사유 경고(admin-actions.ts 의 issueWarning)는 어느 사건에서 나왔는지 남기지
-- 않아 이 칸도 usage_history_id 도 비운다 — 그 경로의 교차 중복은 이 칸 밖이다.
--
-- FK 를 걸지 않는다 — 경고를 쓰는 시점에 그 queue 행은 이미 DELETE 된 뒤다
-- (06 「줄서기」의 「종료」는 저장되는 상태가 아니라 행이 사라지는 것이다 · 05 상태값).
-- REFERENCES ... ON DELETE SET NULL 을 걸면 키가 즉시 NULL 이 되어 UNIQUE 가
-- 무의미해지고, ON DELETE RESTRICT 는 줄서기 종료 자체를 막는다. 지워진 행을
-- 가리키는 역사적 참조값이므로 순수 uuid 칸으로 둔다.
--
-- 완전히 추가적이다 — nullable 이라 기존 행은 전부 NULL 로 남고, NULL 끼리는 부분
-- UNIQUE 에서 서로 충돌하지 않는다(queue_machine_once_idx · warnings_usage_history_id_idx
-- 와 같은 관용구). 관리자의 자유 텍스트 경고(admin-actions.ts issueWarning)는 이
-- 칸을 채우지 않으므로 지금까지와 똑같이 동작한다.

ALTER TABLE warnings
  ADD COLUMN IF NOT EXISTS incident_queue_id uuid NULL;

-- 같은 줄서기 사건을 가리키는 경고는 자동이든 관리자든 DB 가 두 번째를 거부한다(23505).
-- src/lib/expiration.ts 의 applySystemWarning() 이 이 위반을 "이 사건엔 이미 경고가
-- 있다" 로 해석해 조용히 넘어간다 — 누적 횟수도 올리지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS warnings_incident_queue_id_idx
  ON warnings (incident_queue_id)
  WHERE incident_queue_id IS NOT NULL;
