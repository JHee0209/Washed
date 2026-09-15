-- 0004 — 알림함의 「공지」 줄을 원본 공지에 잇는다 (F26 · F17)
--
-- 05 P18: 「등록한 공지는 사생 알림함의 "공지" 탭에 자동으로 반영된다.
--          관리자가 공지를 삭제하면 알림함에서도 사라진다.」
--
-- 뒷문장을 지킬 방법이 없었다 — notifications 에 어느 공지에서 나온 줄인지
-- 적는 칸이 없어, 공지를 지워도 알림함에는 그대로 남았다.
--
-- 06 「알림」에 없던 칸이라 db/migrations/README.md 의 「06 에 없는 것이 필요하면
-- 먼저 팀에 묻는다」에 걸린다 — P18 의 문장을 구현하는 데 필요한 연결이며,
-- 사용자에게 보이는 항목이 늘지는 않는다(화면에 나오지 않는 내부 열쇠다).
--
-- 지우는 것은 없다. 칸 하나와 인덱스 하나만 늘어난다.

-- -----------------------------------------------------------------------------
-- notifications.notice_id  (05 P18 · 06 「알림」 · 「공지」)
-- -----------------------------------------------------------------------------
-- 공지에서 나온 줄만 값이 있고, 배정 · 종료 · 경고 · 결과는 NULL 이다.
-- ON DELETE CASCADE 라 공지를 지우면 그 공지가 만든 알림이 함께 사라진다 —
-- P18 의 "알림함에서도 사라진다" 가 여기서 지켜진다.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notice_id uuid NULL
    REFERENCES notices(notice_id) ON DELETE CASCADE;

-- 공지를 지울 때 딸린 알림을 찾아가는 자리.
CREATE INDEX IF NOT EXISTS notifications_notice_id_idx
  ON notifications (notice_id);
