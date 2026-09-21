-- 0014 — 프로필 사진 (Issue #76)
--
-- report_evidence(0005)와 같은 이유로 bytea 로 DB 안에 둔다 — 이 저장소에는
-- 외부 오브젝트 스토리지가 붙어 있지 않다(팀 확정, 0005 머리말과 동일한 근거).
--
-- users 에 컬럼을 더하지 않고 별도 표로 둔 이유: report_evidence 와 같은 패턴을
-- 그대로 따르고, 사진이 없는 사용자가 대부분인 동안 users 를 매번 큰 bytea 와
-- 함께 읽지 않기 위해서다.
--
-- 사용자당 사진은 정확히 한 장이다 — PK 를 user_id 로 잡아 교체할 때
-- INSERT ... ON CONFLICT (user_id) DO UPDATE 로만 처리되므로, 옛 사진이 별도
-- 행으로 쌓이는 일이 스키마 차원에서 발생하지 않는다.
CREATE TABLE IF NOT EXISTS profile_photos (
  -- 계정이 지워지면 사진도 함께 사라진다 (05 P24 탈퇴 14일 뒤 삭제와 동일 흐름).
  user_id     uuid        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,

  -- 서버가 실제 파일 바이트(매직 넘버)를 보고 정한 값만 들어온다 — Content-Type
  -- 헤더나 확장자를 믿지 않는다. src/lib/profile-photo-rules.ts 의
  -- ALLOWED_PROFILE_PHOTO_MIME 과 같은 집합이어야 한다.
  mime_type   text        NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),

  -- 실제로 읽은 바이트 수 — Content-Length 헤더가 아니다(위조될 수 있다).
  byte_size   integer     NOT NULL CHECK (byte_size > 0),

  -- 파일 자체. base64 로 실려 와 decode(..., 'base64') 로 들어간다
  -- (evidence-storage.ts 와 같은 이유 — @neondatabase/serverless 의 HTTP 드라이버는
  -- Buffer 를 그대로 직렬화하지 못한다).
  bytes       bytea       NOT NULL,

  updated_at  timestamptz NOT NULL DEFAULT now()
);
