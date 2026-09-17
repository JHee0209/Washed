-- 0008 — 경고에 "같은 사건" 참조 칸을 둔다 (05 P6 · Issue #8).
--
-- 근거: Issue #8 "경고는 한 번만 쌓는다 — 자동 판정과 관리자 수동 부여가 같은
-- 건에 두 번 붙지 않게 서버에서 막는다"(05 P6). 지금 warnings 에는 어느 사건에서
-- 나온 경고인지 가리키는 칸이 없어, 시스템 자동 경고(P5 수거 미완료)와 관리자가
-- 신고를 확인하고 주는 경고가 같은 실제 사건을 두 번 벌줄 수 있었다.
--
-- usage_history 한 행이 "이 사용자가 이 기기를 이 시간에 썼다"를 정확히 한 번
-- 가리키는 기존 값이라 이것을 사건 참조로 그대로 쓴다 — 새 "사건" 개념을
-- 만들지 않는다. P5(수거 미완료)는 강제 종료마다 이 행을 이미 만들고 있어
-- 자연스럽게 채울 수 있고, 관리자는 F28(이용 내역) 화면에서 같은 행을 골라
-- 연결한다.
--
-- P3(배정 후 미인증)은 사용을 시작한 적이 없어 usage_history 행이 아예 생기지
-- 않는다 — 이 칸은 그대로 NULL로 남는다. 더 근본적으로 P3은 신고로 관찰할 수
-- 없는 서버 타이밍 실패라(누가 "QR을 안 찍었다"를 목격해서 신고할 방법이 없다)
-- 관리자 경고와 충돌할 현실적 경로 자체가 없다 — 그래서 이 칸을 P3까지 억지로
-- 채우게 만들지 않는다.
--
-- 완전히 추가적이다 — nullable, 기존 행은 전부 NULL로 남고 아무 영향이 없다.
-- 표도 다른 칸도 늘지 않는다(06-data.md 「경고」 항목에 이 칸을 추가로 적었다).

ALTER TABLE warnings
  ADD COLUMN IF NOT EXISTS usage_history_id uuid NULL
    REFERENCES usage_history(history_id) ON DELETE SET NULL;

-- 부분 UNIQUE 인덱스 — 같은 usage_history_id 를 가리키는 경고는 자동이든 관리자든
-- DB 가 두 번째를 물리적으로 거부한다(23505). usage_history_id 가 없는 경고
-- (P3, 또는 특정 이용 건과 무관한 일반 관리자 경고)는 NULL 끼리 서로 충돌하지
-- 않으므로 이 검사에 걸리지 않는다 — queue_machine_once_idx(db/schema.sql)와
-- 같은 관용구다.
CREATE UNIQUE INDEX IF NOT EXISTS warnings_usage_history_id_idx
  ON warnings (usage_history_id)
  WHERE usage_history_id IS NOT NULL;
