-- 0015 — 문의 (Issue #86)
--
-- 06 「검토했으나 제외」에 있던 「문의 내용」("답변은 이메일로 나간다 — 앱에 남기지
-- 않는다")을 저장 항목으로 올린다. 화면(설정 > 문의하기 · F21)은 만들어져 있었지만
-- 보낸 내용이 어디에도 남지 않아 관리자가 문의가 왔다는 사실조차 알 수 없었다 —
-- 그것이 이 표를 만드는 이유다. 06-data.md 도 함께 고쳤다.
--
-- SP8(답변은 문의할 때 쓴 이메일로 보낸다)은 그대로다. 답변 발송은 관리자가 콘솔에서
-- 내용을 읽고 사람이 보낸다 — 이 표는 「관리자가 문의를 읽을 수 있게」 하는 데까지만
-- 쓰이고, 처리 상태값·답변 본문은 두지 않는다(05 에 그 정책이 없다).
CREATE TABLE IF NOT EXISTS inquiries (
  inquiry_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- **누가** 는 세션에서만 온다 (reports.reporter_user_id 와 같은 이유 · 08 · 1번).
  -- 계정이 지워지면 문의도 함께 사라진다 (05 P24 · profile_photos 와 같은 흐름).
  user_id    uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 공백만 있는 문의를 스키마 차원에서 막는다(04 F21 「미입력 시 전송 불가」).
  -- 길이 한도는 src/lib/inquiry-rules.ts 의 MAX_INQUIRY_LENGTH 와 **같은 값**이어야
  -- 한다 — 06·05 에 한도가 없어 서버가 정한 값이다(reports.etc_content 와 같은 패턴).
  content    text        NOT NULL CHECK (btrim(content) <> '' AND length(content) <= 1000),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- 관리자 문의 탭은 최신순으로만 읽는다 (F21 · Issue #86).
CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries (created_at DESC);
