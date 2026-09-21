-- 0010 — 세탁실 전체 점검 상태 (05 P20 · 06 「세탁실」 · F22 · F33 · Issue #47)
--
-- 번호 메모: 팀원 브랜치 origin/fix/admin-warning-reason 가 먼저 0009 를 썼다
-- (경고 사유 확장 · 이 파일과 무관한 내용). 번호 충돌을 피하려고 0010 으로
-- 미뤘다 — 이 파일 내용 자체는 그 브랜치와 관계없다.
--
-- machines.status 의 '점검중'(0006)은 기기 하나 단위다. 이건 완전히 다른 개념 —
-- 세탁실 전체를 한 번에 잠그는 토글이며, 지금까지 06-data.md 「검토했으나 제외」에
-- v2 로 빠져 있던 것을 이번에 MVP 저장 항목으로 올린다.
--
-- 세탁실이 한 곳이라는 전제라 이 표는 항상 정확히 한 행이다 — boolean PK +
-- CHECK(id) 로 두 번째 행을 DB 가 물리적으로 거부한다(23505). updated_at 같은
-- 감사용 칸은 06 에 없는 칸이라 만들지 않는다.
CREATE TABLE IF NOT EXISTS facility_status (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  is_under_inspection boolean NOT NULL DEFAULT false
);

INSERT INTO facility_status (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
