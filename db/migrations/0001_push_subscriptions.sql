-- 0001_push_subscriptions — 06 「푸시 구독」 항목 신설
--
-- 근거: docs/06-data.md 「푸시 구독」 · docs/05-policy.md P26 · docs/08-deployNOTE.md 6번
--
-- 기존 9개 표는 건드리지 않는다. 이 파일이 하는 일은 표 하나를 새로 만드는 것뿐이다.
-- BEGIN · COMMIT 은 적지 않는다 — scripts/db-migrate.mjs 가 파일 하나를
-- 통째로 한 트랜잭션에 넣어 돌린다 (실패하면 이 파일의 변경이 전부 되돌아간다).

-- -----------------------------------------------------------------------------
-- 10. 푸시 구독  (06 「푸시 구독」 · F5 · F9 · F31 · F40)
--     08 · 6번 「기기별 구독 저장」 — 누구의 어느 기기로 보낼지
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  push_subscription_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「누가」 — 이름 · 호실이 아니라 user_id (08 · 1번)
  -- 구독은 사람이 아니라 기기 단위라 한 사람이 여러 줄을 가진다 (05 P26).
  -- 탈퇴 14일 뒤 계정을 지우면 구독도 함께 사라진다 (05 P24 · SP5 · 08 · 9번).
  user_id              uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「구독 정보(폰 알림을 보낼 주소와 열쇠 · 브라우저가 만들어 준다)」
  -- 브라우저가 주는 값 그대로다 — 주소 하나(endpoint)와 열쇠 둘(p256dh · auth).
  -- 주소가 곧 그 기기라서, 같은 기기가 두 번 등록되지 않게 UNIQUE 를 건다.
  -- 발송에 쓰는 비밀 키는 여기 두지 않는다 — 서버의 .env.local 에만 있다 (08 · 6번).
  endpoint             text        NOT NULL UNIQUE,
  p256dh_key           text        NOT NULL,
  auth_key             text        NOT NULL,

  -- 06 「등록 시각」 — 홈 첫 진입에서 알림을 허용한 시각 (05 P26 · F40)
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- 06 「마지막으로 보내는 데 성공한 시각」 · 05 P26
  -- 한 번도 보내지 않았으면 비어 있다.
  -- 보내다 실패하면 이 줄을 지운다 — 그래서 "마지막 실패" 가 아니라 "마지막 성공" 이다.
  -- 보낼 곳이 없어져도 알림함 기록(notifications)은 그대로 남는다 (05 P26 · 08 · 6번).
  last_success_at      timestamptz NULL
);

-- 한 사람의 모든 기기로 보낼 때 훑는 자리 (05 P26 — 여러 기기면 각각 보낸다)
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);
