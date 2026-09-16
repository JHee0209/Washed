-- 0005 — 신고 증거 사진의 파일 자체를 둘 자리 (F11 · 05 P15 · P23 · 08 · 7번)
--
-- 08 · 7번: 「업로드 API · 저장소(S3 등) · 용량 제한 · 보관 기간이 필요하다」
--
-- reports.evidence_photo_url 은 처음부터 있었지만 **주소를 적는 칸일 뿐**이라
-- 가리킬 파일이 어디에도 없었다. 그 파일을 두는 표를 만든다.
--
-- ── 왜 외부 저장소가 아니라 DB 안인가 (팀 확정)
-- db/schema.sql 269줄의 주석은 「파일 자체는 외부 저장소에 두고」였지만, 이 저장소에는
-- S3 · Vercel Blob 어느 것도 붙어 있지 않고 credential 도 없다. 지금 외부 저장소를
-- 들이면 키가 생기기 전까지 F11 이 통째로 동작하지 않는다. 그래서:
--   · 파일은 bytea 로 여기에 두고
--   · /api/reports/[id]/evidence 가 권한을 보고 내려준다 (기본이 private 이다 —
--     증거 사진에는 남의 세탁물이 찍히므로 주소만 알면 보이는 곳에 두지 않는다)
--   · 신고와 사진이 **한 트랜잭션**에 들어가 orphan 파일이 생기지 않는다
--   · 삭제(P23 3개월 · P24 탈퇴)가 DELETE 한 줄로 끝난다
-- 나중에 외부 저장소로 옮길 때 고칠 곳은 src/lib/evidence-storage.ts 하나다.
--
-- ── 신고 1건에 사진 1장
-- report_id 가 그대로 기본키다. 07 화면의 첨부 슬롯이 하나고(설정 화면 「증거 사진
-- (필수)」) 06 「신고」의 예시도 `(사진)` 한 장이라, 지금 요구를 만족하는 가장 단순한
-- 구조다. 여러 장이 필요해지면 그때 기본키를 따로 두고 report_id 에 인덱스를 건다.
--
-- ── 06 에 없는 표가 아닌가
-- 06 「신고」의 저장 항목 「증거 사진」이 실제로 놓이는 자리다. 06 의 항목이 늘지
-- 않고, 사용자에게 보이는 것도 늘지 않는다 (0004 와 같은 성격의 변경이다).
--
-- 지우는 것은 없다. 표 하나와 인덱스 하나만 늘어난다.

-- -----------------------------------------------------------------------------
-- report_evidence  (06 「신고」 → 「증거 사진」 · 05 P15 · P23)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_evidence (
  -- 신고 1건에 사진 1장. 신고가 지워지면 사진도 함께 사라진다.
  -- users → reports 가 ON DELETE CASCADE 이므로, 신고자가 지워지면
  -- 신고를 거쳐 사진까지 한 번에 사라진다 (05 P23 「신고자가 탈퇴하면 함께 삭제」).
  report_id    uuid        PRIMARY KEY REFERENCES reports(report_id) ON DELETE CASCADE,

  -- 서버가 실제 파일을 보고 정한 값만 들어온다.
  -- 목록은 src/lib/report-rules.ts 의 ALLOWED_EVIDENCE_MIME 과 같아야 한다.
  mime_type    text        NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),

  -- 실제로 읽은 바이트 수 (Content-Length 헤더가 아니다 — 그것은 위조된다)
  byte_size    integer     NOT NULL CHECK (byte_size > 0),

  -- 파일 자체. base64 로 실려 와 decode(..., 'base64') 로 들어간다.
  bytes        bytea       NOT NULL,

  -- 05 P23 「올린 시점부터 3개월」의 기산점
  uploaded_at  timestamptz NOT NULL DEFAULT now(),

  -- 05 P23 — **삭제 기준 시점을 행에 박아 둔다.** 보관 기간을 나중에 바꿔도
  -- 이미 올라온 사진은 올릴 때 약속한 시점에 지워진다. 배치는 이 칸만 본다.
  delete_after timestamptz NOT NULL
);

-- 3개월 삭제 배치가 훑는 자리 (05 P23 · 08 · 9번 · src/lib/cleanup.ts)
CREATE INDEX IF NOT EXISTS report_evidence_delete_after_idx
  ON report_evidence (delete_after);

-- -----------------------------------------------------------------------------
-- reports 의 CHECK 는 건드리지 않는다 — 일부러 그렇다
-- -----------------------------------------------------------------------------
-- reports_evidence_only_for_laundry_left 는 「세탁물 있음」에 evidence_photo_url 이
-- NOT NULL 일 것을 요구한다. 3개월이 지나 사진을 지울 때 그 칸까지 비우려면 이
-- 제약을 풀어야 하는데, 그러면 P15 의 「사진 없이는 접수되지 않는다」를 DB 가 더는
-- 지키지 못한다. 접수 시점의 무결성이 보관 기간보다 중요하다.
--
-- 그래서 배치는 report_evidence 행(= 실제 파일)만 지우고 reports 의 주소 칸은 둔다.
-- 파일이 없어진 뒤 /api/reports/[id]/evidence 는 410 을 돌려주고, 화면에서는
-- 사진이 사라진다 — P23 의 확인 방법 「목록에서 사진이 사라짐」이 그대로 지켜진다.
