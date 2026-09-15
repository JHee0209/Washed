-- 0003 — 이메일 인증코드 (F14 가입 인증 · F35 비밀번호 재설정)
--
-- 06-data.md 「이메일 인증코드」 저장 항목을 이 마이그레이션과 함께 새로 만들었다.
-- 06 에 없던 항목이라 db/migrations/README.md 의 「06 에 없는 것이 필요하면 먼저
-- 팀에 묻는다」 에 걸린다 — 팀 확정 후 추가한 것이며, 근거는 08-deployNOTE.md 25번 줄
-- (「서버가 생성 · 메일 발송 · 검증 · 코드는 절대 클라이언트로 내려보내지 않는다」)이다.
--
-- 지우는 것은 없다. 표 하나와 인덱스 둘만 늘어난다.
--
-- 세션 표는 만들지 않는다 — JWT 쿠키를 쓴다(팀 확정 · 08 · 1번).

-- -----------------------------------------------------------------------------
-- 12. 이메일 인증코드  (06 「이메일 인증코드」 · F14 · F35 · 05 P11 · P22)
--     08 · 1번 — 회원가입 화면의 '123456' 과 비밀번호찾기의 static CODE 가 오는 자리
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verifications (
  verification_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「받는 이메일」 — 아직 users 에 없는 사람에게도 보내므로(F14 는 가입 전이다)
  -- user_id 가 아니라 이메일 그대로 둔다. users 를 가리키지 않는 유일한 표다.
  -- 소문자로 맞춰 저장한다 — 서버가 넣기 전에 낮춘다 (05 P11).
  email           text        NOT NULL
                              CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+[.]ac[.]kr$'),

  -- 06 「용도(회원가입 / 비밀번호 재설정)」
  -- 두 흐름의 코드가 서로 통하면 안 된다 — 가입 코드로 남의 비밀번호를 바꿀 수 없다.
  purpose         text        NOT NULL
                              CHECK (purpose IN ('회원가입', '비밀번호 재설정')),

  -- 06 「코드(6자리 · 해시로 저장)」 · 05 P22
  -- 평문으로 두지 않는다. DB 가 새어도 코드가 그대로 나가지 않게 scrypt 로 해시한다.
  -- 6자리라 해시만으로는 약하지만, 유효 시간(3분 · 5분)과 시도 횟수 제한이 함께 막는다.
  code_hash       text        NOT NULL,

  -- 06 「만료 시각」 · 05 P22
  -- 가입은 3분 · 재설정은 5분. 두 숫자는 서버 코드에 있고 여기에 박지 않는다.
  --   재설정 5분은 P22 에 적힌 값이다.
  --   가입 3분은 프로토타입(회원가입.dc.html)의 값이고 05 에는 아직 없다 — [?] 팀 확인 필요.
  expires_at      timestamptz NOT NULL,

  -- 틀린 횟수. 5회를 넘기면 그 코드는 죽는다 (무차별 대입 방지).
  attempt_count   integer     NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),

  -- 06 「인증 완료 시각」 — 코드가 맞은 시각. 아직이면 비어 있다.
  verified_at     timestamptz NULL,

  -- 인증을 마치면 서버가 일회용 표를 하나 발급해 화면에 준다.
  -- 가입 폼 제출(F15) · 새 비밀번호 저장(F35)은 코드가 아니라 이 표를 들고 온다.
  -- 코드를 두 번 보내지 않아도 되고, 표는 한 번 쓰면 consumed_at 이 찍혀 죽는다.
  ticket_hash     text        NULL,

  -- 06 「사용 완료 시각」 — 표를 실제로 쓴 시각. 쓰고 나면 다시 못 쓴다.
  consumed_at     timestamptz NULL,

  -- 06 「보낸 시각」 — 재발송 쿨다운(60초)의 기준점이기도 하다
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- 표를 발급하지 않고 사용 완료가 될 수는 없다
  CONSTRAINT email_verifications_consumed_needs_ticket CHECK (
    consumed_at IS NULL OR ticket_hash IS NOT NULL
  )
);

-- 「이 이메일 · 이 용도의 가장 최근 코드」를 찾을 때 훑는 자리.
-- 코드는 항상 최신 한 줄만 유효하다 — 재발송하면 이전 줄은 무시된다.
CREATE INDEX IF NOT EXISTS email_verifications_email_purpose_idx
  ON email_verifications (email, purpose, created_at DESC);

-- 만료된 줄을 지우는 배치가 훑는 자리 (08 · 9번).
-- 인증코드는 06 의 다른 항목과 달리 보관할 이유가 없다 — 만료 24시간 뒤 지운다.
CREATE INDEX IF NOT EXISTS email_verifications_expires_at_idx
  ON email_verifications (expires_at);
