-- 0007 — 보관 기간 삭제 배치가 훑는 자리에 인덱스를 둔다 (F36 · 05 P14 · P17 · P18 ·
--        SP4 · 08 · 9번)
--
-- 근거: docs/05-policy.md 「보관 기간과 조회 기간」 · docs/08-deployNOTE.md 9번
--
-- 08 · 9번이 「서버 배치 삭제」로 남겨 둔 나머지(이용 내역 · 경고 · 신고 · 공지 ·
-- 알림)를 src/lib/cleanup.ts 가 실제로 지우기 시작한다. 그 배치는 **시각 칸 하나만**
-- 보고 훑는다:
--
--   notifications.received_at   30일 · 「공지」만 3개월 (05 P14)
--   usage_history.started_at    3개월                  (05 P17 · SP4)
--   warnings.issued_at          3개월                  (05 SP4)
--   reports.created_at          3개월                  (05 P23 · SP4)
--
-- 그런데 지금 있는 인덱스는 전부 **앞 칸이 user_id 거나 status** 라(조회 화면이
-- 사람별로 읽기 때문이다) 시각 단독 조건에는 쓰이지 않는다. 배치가 매일 표를 통째로
-- 훑게 된다. 0005 가 report_evidence_delete_after_idx 를 같은 이유로 만든 전례를 따른다.
--
-- notices.created_at · email_verifications.expires_at 는 이미 인덱스가 있어 여기 없다
-- (notices_created_at_idx · email_verifications_expires_at_idx).
-- users.withdraw_requested_at 도 부분 인덱스가 이미 있다.
--
-- 표도 칸도 늘지 않는다 — 06-data.md 의 저장 항목이 그대로이므로
-- scripts/db-check.mjs 의 목록도 고치지 않는다. **지우는 것은 없다. 인덱스 넷만 늘어난다.**

-- -----------------------------------------------------------------------------
-- 알림 30일 · 공지 3개월 (05 P14 · cleanup.ts deleteExpiredNotifications)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notifications_received_at_idx
  ON notifications (received_at);

-- -----------------------------------------------------------------------------
-- 이용 내역 3개월 (05 P17 · SP4 · cleanup.ts deleteExpiredUsageHistory)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS usage_history_started_at_idx
  ON usage_history (started_at);

-- -----------------------------------------------------------------------------
-- 경고 기록 3개월 (05 SP4 · cleanup.ts deleteExpiredWarnings)
--
-- 경고 **누적 횟수 · 이용 제한**(usage_restrictions)은 여기 없다 — 05 의 대조표가
-- 「지우지 않는다 — 0회로 되돌린다」로 정한 값이라 배치가 건드리지 않는다 (P7).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS warnings_issued_at_idx
  ON warnings (issued_at);

-- -----------------------------------------------------------------------------
-- 신고 3개월 (05 P23 · SP4 · cleanup.ts deleteExpiredReports)
--
-- reports_status_created_at_idx 가 이미 있지만 앞 칸이 status 라, 상태를 가리지 않고
-- 시각만 보는 배치의 조건에는 쓰이지 않는다.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reports_created_at_idx
  ON reports (created_at);
