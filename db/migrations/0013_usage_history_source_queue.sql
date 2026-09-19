-- 0013 — 이용 내역이 "어느 줄서기 사건에서 나왔는지" 를 기억한다 (05 P6 · Issue #8).
--
-- 근거: 05 P6 「겹쳐도 통합 1회」 · 08 · 4번 「자동 판정과 관리자 수동 부여가 같은 건에
-- 두 번 붙지 않도록 서버에서 막는다」.
--
-- ── 무엇이 문제였나
-- 0012 가 warnings.incident_queue_id 를 사건 키로 두었지만, **같은 실제 사건이 만료
-- 전후로 이름이 바뀌었다.** 만료 전에는 줄서기 행(queue_id)이고, 만료되면 그 행은
-- 사라지고 이용 내역(history_id)만 남는다. 그래서
--   ① 관리자가 만료 전에 진행 중인 줄에 경고를 주고(incident_queue_id = Q)
--   ② 스케줄러가 그 줄을 만료시켜 이용 내역 H 를 만들면
--   ③ 관리자 화면에는 H 가 "아직 경고 없음" 으로 보여 **같은 사건에 두 번째 경고**를
--      줄 수 있었다.
-- 두 이름을 사후에 이어 붙이는(backfill) 방법도 검토했지만, 이용 내역이 밖에 보이는
-- 시점과 이어 붙이는 시점 사이에 관리자 요청이 끼어들 수 있어 **경고 두 줄이 남는
-- 창이 없어지지 않았다.**
--
-- ── 이 마이그레이션의 방법
-- 사건의 이름을 **하나로 유지한다.** 이용 내역을 만들 때 원래 줄서기 id 를 함께
-- 적어 두면, 만료 뒤에도 H → Q 로 되짚을 수 있다. 그러면 관리자가 어느 화면에서
-- 시작하든(진행 중인 줄 / 끝난 이용) 경고는 **같은 Q 를 향해** INSERT 되고,
-- 0012 의 warnings_incident_queue_id_idx 하나가 순서와 무관하게 중복을 막는다.
-- 사후 연결이 필요 없어지므로 그 사이의 경쟁 창도 함께 사라진다.
--
-- 한 queue 행이 사건 하나를 대표한다는 것은 코드에서 확인했다 — queue.status 를 쓰는
-- 곳은 assignment.ts(대기 중→배정) · usage.ts(배정→사용중) · expiration.ts(사용중→
-- 수거대기) 셋뿐이고 전부 한 방향이라 되돌아오는 경로가 없다. queue_id 는 그동안
-- 바뀌지 않고, 다시 줄을 서면(05 P8) 새 행이 생겨 새 사건이 된다.
--
-- ── FK 를 걸지 않는다
-- 이용 내역을 만드는 그 문장이 같은 queue 행을 DELETE 한다(usage.ts finishUsage 의
-- removed CTE · expiration.ts expireOverduePickups 의 expired CTE). 커밋 시점에 이미
-- 없는 행이라 REFERENCES 를 걸 수 없다 — warnings.incident_queue_id(0012)를 순수
-- uuid 로 둔 것과 같은 이유다.
--
-- 완전히 추가적이다 — nullable 이라 기존 행은 전부 NULL 로 남는다. 그 행들이 가리키던
-- queue 행은 이미 사라져 **소급해서 채울 근거가 없다.** 추정해서 채우지 않는다.
-- 0013 이전 이용 내역은 예전처럼 warnings.usage_history_id(0008)의 부분 UNIQUE 로만
-- 보호되는 legacy 데이터이고, 조회 쪽(admin-actions.ts adminUserIncidents)이 그 경우를
-- fallback 으로 함께 본다.

ALTER TABLE usage_history
  ADD COLUMN IF NOT EXISTS source_queue_id uuid NULL;

-- 한 줄서기 사건은 이용 내역을 최대 하나만 남긴다 — 정상 종료(finishUsage)와 강제
-- 종료(expireOverduePickups)가 같은 queue 행을 두고 DELETE ... RETURNING 으로 경쟁해
-- 한쪽만 이기기 때문이다. H → Q 해석이 항상 한 값이 되도록 그 불변식을 DB 에 적는다.
-- NULL 끼리는 충돌하지 않으므로 legacy 행은 이 검사에 걸리지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS usage_history_source_queue_id_idx
  ON usage_history (source_queue_id)
  WHERE source_queue_id IS NOT NULL;
