-- 0005 — 기기 상태값에 「점검중」을 추가한다 (05 P10 · P20 · 06 「기기」)
--
-- 관리자 콘솔의 setMachineStatus (src/lib/admin-actions.ts) 는 이미
-- '점검중' 을 유효한 값으로 검사하고 tabs.tsx 도 그 값으로 버튼을 단다 —
-- 하지만 이 CHECK 제약이 '사용가능' · '사용중' · '고장' 세 값만 허용하고
-- 있어서 실제로 넣으면 항상 실패했다. 여기서는 이미 코드가 기대하던
-- 값을 DB 가 받아들이게 할 뿐, 새 동작을 만들지는 않는다.
--
-- 이건 05 P20(세탁실 전체 점검 모드)이 아니라 기기 하나 단위의 상태다 —
-- P20 의 "세탁실 전체를 잠그는 토글"은 06-data.md 에 저장 항목이 없는
-- v2(F33)로 그대로 남는다. docs/06-data.md · docs/08-deployNOTE.md 에도
-- 같이 반영했다.

ALTER TABLE machines DROP CONSTRAINT machines_status_check;

ALTER TABLE machines
  ADD CONSTRAINT machines_status_check
  CHECK (status IN ('사용가능', '사용중', '고장', '점검중'));
