-- =============================================================================
-- Washed — 저장 구조 (PRD 5절 「제작 순서」 1번)
--
-- 근거 문서
--   docs/06-data.md       「저장 항목」 표 — 테이블과 칸은 전부 여기서 왔다
--   docs/05-policy.md     P 번호 — 칸의 한도 · 상태값
--   docs/08-deployNOTE.md 1번(식별자) · 2번(localStorage 키 → 테이블)
--
-- 테이블 12개. 06 의 저장 항목은 13개지만 「언어 설정」은 사람이 아니라
-- 기기(브라우저) 단위라 테이블을 만들지 않는다 (06 마지막 문단 · 05 P25 · 08 · 2번).
-- (「이메일 인증코드」는 F14 · F35 를 서버로 옮기며 새로 만든 12번 표다 · 0003)
-- 세션 표는 없다 — JWT 쿠키를 쓴다(팀 확정).
-- (「푸시 구독」도 기기 단위지만 누구의 기기인지를 서버가 알아야 해서 표로 둔다 · 05 P26)
--
-- 여기 없는 테이블 · 칸은 06 에도 없다. 06 「검토했으나 제외」의
-- 알림 수신 설정 · 세탁실 점검 상태 · 문의 내용은 v2 라서 만들지 않았다.
-- (「공지」는 F26 이 v2 에서 MVP 로 올라오면서 06 의 저장 항목이 되어 11번 표로 있다)
--
-- 규칙
--   · 기본키는 전부 UUID (gen_random_uuid() 기본값 · PostgreSQL 13+ 내장)
--   · 사람을 가리킬 때는 학번 · 이름 · 호실이 아니라 user_id 로 가리킨다
--     (08 · 1번 · 05 P16 · R29)
--   · 상태값 문자열은 05 「상태값」 절의 한국어를 그대로 쓴다
--     (영어로 옮기면서 문서와 어긋나는 것을 막는다)
--   · 시각은 전부 timestamptz — 만료 판정은 서버 시각 기준이다 (08 · 4번)
--
-- 이 파일은 「지금 스키마의 전체 모습」이다 — 아무것도 없는 새 DB 를 세울 때 쓴다.
-- 이미 쓰고 있는 DB 를 바꿀 때는 이 파일을 고쳐 다시 돌리는 것이 아니라
-- db/migrations/ 에 파일을 하나 더 만들고 같은 변경을 여기에도 반영한다.
-- 방식은 db/migrations/README.md 에 있다.
--
-- 새 DB:   npm run db:push  →  npm run db:migrate
-- 바꿀 때: npm run db:migrate
-- 확인:    npm run db:check
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. 사용자  (06 「사용자」 · F14 · F15 · F20 · F29 · F32 · F35 · F36 · F38 · F39)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  -- 기본키는 user_id 다. 학번 · 이메일은 키로 쓰지 않되 UNIQUE 는 건다
  -- (08 · 1번 — 이름+호실 조합은 동명이인 · 호실 이동 때 어긋난다 · R29 · 05 P11 · P16)
  user_id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「이름」
  name                  text        NOT NULL,

  -- 06 「아이디(학교 이메일 · ac.kr 로 끝남)」 · 05 P11
  -- 범위를 ac.kr 까지 넓게 열어 둔 것은 팀 확정이다 (PRD 6절 · 05 P11).
  -- 구글 로그인의 hd 값은 화면 힌트일 뿐이고 자격 판단은 서버가 한다 (08 · 1번).
  email                 text        NOT NULL UNIQUE
                                    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+[.]ac[.]kr$'),

  -- 06 「비밀번호(8자 이상 · 해시로 저장)」 · 05 P11 · P22
  -- NULL 을 허용한다 — 구글로 가입한 사람은 비어 있고, 나중에 설정 > 프로필 수정에서
  -- 채운다 (F20 · v2). 8자 이상은 평문 규칙이라 해시에는 걸 수 없다 —
  -- 서버가 해시로 바꾸기 전에 검사한다.
  password_hash         text        NULL,

  -- 06 「가입 방식(이메일 / 구글)」 · 05 P11
  -- 처음 어떻게 들어왔는지의 기록일 뿐이다.
  -- ★ 이메일 로그인이 되는지는 이 칸이 아니라 password_hash 가 NULL 인지로 판단한다
  --   (NULL 이면 구글로만 · 값이 있으면 두 가지 다 · 06 「사용자」 · 05 P11).
  --   아이디(학교 이메일)가 같으면 가입 방식이 달라도 같은 계정이다.
  signup_method         text        NOT NULL
                                    CHECK (signup_method IN ('이메일', '구글')),

  -- 06 「성별」 — 06 이 값을 열거하지 않아 CHECK 를 걸지 않았다
  gender                text        NOT NULL,

  -- 06 「소속(학교)」
  school                text        NOT NULL,

  -- 06 「학번(숫자만 · 12자리까지 · 필수)」 · 05 P11
  -- 가입 때만 받고 사생은 고칠 수 없다 — 정보 수정 API 는 이 칸을 받지 않는다 (08 · 1번).
  -- 관리자가 사람을 가려낼 때 쓰는 값이라 UNIQUE 지만 기본키는 아니다 (05 P16 · R29).
  student_id            text        NOT NULL UNIQUE
                                    CHECK (student_id ~ '^[0-9]{1,12}$'),

  -- 06 「호실」
  room                  text        NOT NULL,

  -- 06 「가입 시각」
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- 06 「탈퇴 신청 시각(비어 있으면 정상 · 값이 있으면 탈퇴 대기 · 14일 뒤 삭제)」 · 05 P24
  -- 14일이 지난 계정을 지우는 것은 서버 배치다 (08 · 9번). 익명화가 아니라 삭제다.
  withdraw_requested_at timestamptz NULL
);

-- 06 에는 전화번호 칸이 없다 — 수집하지 않는다 (05 SP3 · 08 · 1번).
-- 06 「언어 설정」도 사용자 칸으로 만들지 않는다 — 기기 단위다 (05 P25).

-- 탈퇴 14일 배치가 훑는 자리 (05 P24 · 08 · 9번)
CREATE INDEX IF NOT EXISTS users_withdraw_requested_at_idx
  ON users (withdraw_requested_at)
  WHERE withdraw_requested_at IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 2. 기기  (06 「기기」 · F1 · F2 · F8 · F12 · F22)
--    08 · 2번 washed_machines · washed_admin_faults 가 옮겨 오는 자리
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
  machine_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「이름」 (예: 세탁기 3호기)
  -- 세탁실이 한 곳이라는 전제라 이름이 겹치지 않는다
  -- (08 · 10번 — 동 · 층이 여러 개가 되면 이 UNIQUE 가 바뀐다)
  name        text        NOT NULL UNIQUE,

  -- 06 「종류(세탁기 / 건조기)」
  kind        text        NOT NULL CHECK (kind IN ('세탁기', '건조기')),

  -- 06 「상태값(사용가능 / 사용중 / 고장 / 점검중)」 · 05 상태값 · P10 · P20
  -- 고장 · 점검중은 관리자가 수동 전환한다. 사용중일 때는 강제 사용가능
  -- 처리 뒤에만 고장 · 점검중으로 바꾼다. 점검중은 기기 단위 상태이며
  -- P20 의 세탁실 전체 점검 모드(v2 · 06-data.md 에 저장 항목 없음)와는 다르다.
  status      text        NOT NULL DEFAULT '사용가능'
                          CHECK (status IN ('사용가능', '사용중', '고장', '점검중')),

  -- 06 「종료 예정 시각(세탁 60분 · 건조 45분)」 · 05 P4
  -- 사용중이 아닐 때는 비어 있다. 60분 · 45분은 서버 코드의 값이고 여기에 박지 않는다
  -- ([?] 실제 코스 시간과 맞는지는 아직 열린 질문 — PRD 1절 · 05 P4).
  ends_at     timestamptz NULL
);

-- 05 P2 「같은 종류 중 가장 먼저 끝나는 기기」를 서버가 고를 때 쓰는 자리 (08 · 3번)
CREATE INDEX IF NOT EXISTS machines_kind_status_ends_at_idx
  ON machines (kind, status, ends_at);


-- -----------------------------------------------------------------------------
-- 3. 줄서기  (06 「줄서기」 · F3 · F4 · F5 · F6 · F7 · F8 · F9 · F10)
--    08 · 2번 washed_typequeue 가 옮겨 오는 자리 · 배정 판정은 서버가 한다 (08 · 3번)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue (
  queue_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「누가」 — 이름 · 호실이 아니라 user_id (08 · 1번)
  user_id            uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「기기 종류」 · 05 P1 (같은 종류 1줄 · 최대 2줄)
  machine_kind       text        NOT NULL CHECK (machine_kind IN ('세탁기', '건조기')),

  -- 06 「어느 기기(배정된 뒤에만)」 · 05 P2
  -- 대기 중에는 비어 있다. 특정 호기를 골라 예약하는 것은 제외됐다 (PRD 1절 · 05 P2).
  machine_id         uuid        NULL REFERENCES machines(machine_id) ON DELETE SET NULL,

  -- 06 「상태값(대기 중 / 배정 / 사용중 / 수거대기)」 · 05 상태값
  -- 「종료」는 06 의 값 목록에 없다 — 끝난 줄은 이 표에 남기지 않고 이용 내역으로 간다.
  status             text        NOT NULL DEFAULT '대기 중'
                                 CHECK (status IN ('대기 중', '배정', '사용중', '수거대기')),

  -- 06 「줄 선 시각」 · 05 P8 (다시 서면 그 시각으로 맨 뒤 — 이전 순번을 유지하지 않는다)
  queued_at          timestamptz NOT NULL DEFAULT now(),

  -- 06 「배정 시각(앞사람 종료로 기기가 사용가능이 된 시각)」 · 05 상태값 · 08 · 4번
  -- 앞사람의 수거 3분은 다음 사람의 10분에 들어가지 않는다.
  assigned_at        timestamptz NULL,

  -- 06 「배정 마감 시각(배정 시각 + 10분)」 · 05 P3
  -- 넘기면 배정 해제 + 경고 1회. 배정 상태에서는 줄 빠지기를 할 수 없다 (05 P3).
  assign_deadline_at timestamptz NULL,

  -- 06 「수거 마감 시각(타이머 0 + 3분)」 · 05 P5
  pickup_deadline_at timestamptz NULL,

  -- 05 P1 — 같은 종류에 두 번 줄 설 수 없다. 세탁기 1줄 + 건조기 1줄, 최대 2줄까지.
  -- 화면이 아니라 서버가 막는다 (08 · 3번).
  CONSTRAINT queue_one_line_per_kind UNIQUE (user_id, machine_kind)
);

-- 05 P2 「줄 선 순서대로」 배정할 때 훑는 자리
-- (08 · 3번 — 대기열 갱신은 트랜잭션 · 행 잠금으로 한다)
CREATE INDEX IF NOT EXISTS queue_kind_queued_at_idx
  ON queue (machine_kind, queued_at);

-- 같은 기기에 두 명이 배정되는 것을 막는다
-- (08 · 3번 — 지금 localStorage 구조의 가장 큰 구멍이다)
CREATE UNIQUE INDEX IF NOT EXISTS queue_machine_once_idx
  ON queue (machine_id)
  WHERE machine_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 4. 경고  (06 「경고」 · F6 · F10 · F13 · F32)
--    08 · 2번 washed_warnlog 가 옮겨 오는 자리
--    — 사생이 고칠 수 없는 서버에만 둔다 (05 P16)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warnings (
  warning_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「누가」 — 경고는 호실이 아니라 사용자 단위로 기록한다 (05 P16 · 08 · 1번)
  user_id    uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「사유」 · 05 P6-1 · P16 — 서버가 판정하는 것과 관리자가 판단하는 것이 갈린다
  --   [시스템 자동] expiration.ts 만 찍는다
  --   배정 후 미인증 : 배정 10분 안에 QR 인증이 없었다 (P3)
  --   수거 미완료   : 다했어요 미클릭 · 세탁물 미수거 — 겹쳐도 통합 1회다 (P5 · P6)
  --   [관리자 수동] admin-actions.ts 만 찍는다 (2026-09-17 팀 확정 · 0009)
  --   순서 미준수   : 줄 순서를 지키지 않고 기기를 썼다
  --   세탁물 방치   : 다 된 세탁물을 계속 두고 가져가지 않았다
  --   [과거 값] 새로 부여하지 않지만 이미 저장된 행이 있어 남긴다
  --   신고 확인     : 관리자가 신고를 사실로 확인한 건 (P16)
  reason     text        NOT NULL
                         CHECK (reason IN ('배정 후 미인증', '수거 미완료',
                                           '순서 미준수', '세탁물 방치',
                                           '신고 확인')),

  -- 06 「부여 방식(시스템 자동 / 관리자)」 · 05 P6-1 · P16
  issued_by  text        NOT NULL CHECK (issued_by IN ('시스템 자동', '관리자')),

  -- 06 「부여 시각」
  issued_at  timestamptz NOT NULL DEFAULT now()

  -- 06 「사건 참조(이용 내역, 선택 · 05 P6)」는 usage_history 뒤에서 ALTER 로 붙인다
  -- (0008) — usage_history 가 이 표보다 뒤(8번)에 있어 여기서는 아직 참조할 수 없다.
);

-- 기록 화면(최근 30일 · 05 P21) · 관리자 조회 (05 SP4)
CREATE INDEX IF NOT EXISTS warnings_user_issued_at_idx
  ON warnings (user_id, issued_at DESC);

-- 3개월 삭제 배치 (05 SP4 · 08 · 9번 · 0007). 배치는 사람을 가리지 않고 시각만 보므로
-- 위의 (user_id, issued_at) 인덱스가 쓰이지 않는다.
CREATE INDEX IF NOT EXISTS warnings_issued_at_idx
  ON warnings (issued_at);


-- -----------------------------------------------------------------------------
-- 5. 이용 제한  (06 「이용 제한」 · F3 · F13 · F29 · F32)
--    08 · 2번 washed_warnings → warning_summary (사용자별 누적) 가 옮겨 오는 자리
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_restrictions (
  -- 06 「누가」 — 사용자당 한 줄이라 user_id 자체가 기본키다
  user_id          uuid        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「누적 횟수(3회면 제한 · 매달 1일 0회)」 · 05 P7
  -- 매달 1일 초기화와 제한 종료 초기화 둘 다 유지한다
  -- (05 「확인할 수 없어 표시해 둔 것」 팀 확정 · 08 · 4번)
  warning_count    integer     NOT NULL DEFAULT 0 CHECK (warning_count >= 0),

  -- 06 「제한 시작 시각」 — 제한 중이 아니면 비어 있다
  restricted_from  timestamptz NULL,

  -- 06 「제한 종료 시각(3일 · 종료되면 0회)」 · 05 P7
  restricted_until timestamptz NULL
);

-- 제한 3일 종료를 처리하는 서버 스케줄러가 훑는 자리 (05 P7 · 08 · 4번)
CREATE INDEX IF NOT EXISTS usage_restrictions_until_idx
  ON usage_restrictions (restricted_until)
  WHERE restricted_until IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 6. 신고  (06 「신고」 · F11 · F24 · F31)
--    08 · 2번 washed_reports 가 옮겨 오는 자리 · 08 · 7번 (증거 사진 업로드)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  report_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「신고자」 — 08 · 1번 (설정 화면의 고정 문자열 reporter 가 여기로 온다)
  -- 결과 알림은 신고한 사람에게만 간다 (05 P19).
  reporter_user_id   uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「사유」 · 05 P15
  reason             text        NOT NULL
                                 CHECK (reason IN ('기기 고장', '순서 미준수', '세탁물 있음', '기타')),

  -- 06 「기기 종류」 · 「호기」 · 05 P15
  -- 기기 관련 사유 세 가지는 둘 다 필수, 「기타」는 기기를 고르지 않으므로 둘 다 비어 있다.
  -- 06 이 기기를 종류 + 호기로 적으므로 machines 를 가리키지 않고 그대로 적는다.
  machine_kind       text        NULL CHECK (machine_kind IN ('세탁기', '건조기')),
  machine_no         smallint    NULL CHECK (machine_no > 0),

  -- 06 「증거 사진」 · 05 P15 · P23
  -- 「세탁물 있음」에만 있고 필수다 — 남의 세탁물을 꺼내는 근거라 사진 없이는 접수되지 않는다.
  -- 나머지 세 사유에는 칸 자체가 없다(= 반드시 비어 있다). 아래 CHECK 가 그것을 막는다.
  -- 화면만이 아니라 서버도 같은 조건을 본다 (08 · 7번 · src/lib/report-rules.ts).
  -- 여기에는 **주소만** 둔다. 파일 자체는 아래 14번 report_evidence 에 있고,
  -- 이 칸에는 서버가 조립한 `/api/reports/<report_id>/evidence` 가 들어간다 (0005).
  -- 주소를 클라이언트가 보내는 것이 아니라 서버가 만든다 — 임의 경로를 넣을 수 없다.
  -- 올린 시점부터 3개월 보관 후 삭제 · 신고자가 탈퇴하면 그 전이라도 함께 삭제한다 (05 P23).
  -- 그때 지우는 것은 14번의 파일이고 **이 주소 칸은 남는다** — 이유는 14번 주석에 있다.
  evidence_photo_url text        NULL,

  -- 06 「기타 내용」
  etc_content        text        NULL,

  -- 06 「상태값(접수됨 / 처리중 / 처리완료 / 반려)」 · 05 상태값 · P9
  -- 처리완료 · 반려는 되돌릴 수 없다(역방향 없음) — 그 판정은 서버 코드에서 한다.
  status             text        NOT NULL DEFAULT '접수됨'
                                 CHECK (status IN ('접수됨', '처리중', '처리완료', '반려')),

  -- 06 「접수 시각」 — 증거 사진 3개월 보관의 기산점도 이 시각이다 (05 P23)
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- 05 P15 — 증거 사진은 「세탁물 있음」에만 있고 필수다
  CONSTRAINT reports_evidence_only_for_laundry_left CHECK (
    (reason =  '세탁물 있음' AND evidence_photo_url IS NOT NULL) OR
    (reason <> '세탁물 있음' AND evidence_photo_url IS NULL)
  ),

  -- 05 P15 — 기기 관련 세 사유는 기기 종류 · 호기가 필수, 「기타」는 기기를 고르지 않는다
  CONSTRAINT reports_machine_only_for_machine_reasons CHECK (
    (reason =  '기타' AND machine_kind IS NULL     AND machine_no IS NULL) OR
    (reason <> '기타' AND machine_kind IS NOT NULL AND machine_no IS NOT NULL)
  )
);

-- 관리자 신고 내역 목록 (F24)
CREATE INDEX IF NOT EXISTS reports_status_created_at_idx
  ON reports (status, created_at DESC);

-- 3개월 삭제 배치 (05 SP4 · P23 · 08 · 9번 · 0007). 배치는 상태를 가리지 않고 접수
-- 시각만 보므로 위의 (status, created_at) 인덱스가 쓰이지 않는다.
CREATE INDEX IF NOT EXISTS reports_created_at_idx
  ON reports (created_at);


-- -----------------------------------------------------------------------------
-- 7. 알림  (06 「알림」 · F5 · F9 · F17 · F18 · F31)
--    08 · 2번 washed_unread 는 이 표의 읽음 여부로 계산한다
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  notification_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「받는 사람」
  user_id         uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「종류(공지 / 배정 / 종료 / 경고 / 결과)」
  -- 여기의 「공지」는 알림함 한 줄의 종류 값일 뿐, 공지 자체가 아니다 —
  -- 공지 원본은 11번 notices 표에 따로 있다 (06 「공지」 · 05 P18 · F26).
  -- 관리자가 공지를 등록하면 알림함의 "공지" 탭에 자동으로 반영되고, 지우면 함께
  -- 사라진다(아래 notice_id 가 그 연결이다).
  --
  -- 보관 기간은 **종류마다 다르다** (05 P14 · 「보관 기간과 조회 기간」):
  --   배정 · 종료 · 경고 · 결과 … 30일
  --   공지 ……………………………… 3개월 (공지 원본이 3개월 남으므로 · P18 의 예외)
  -- 30일 하나로 읽지 않는다 — 그러면 아직 살아 있는 공지를 사생만 못 보게 된다.
  kind            text        NOT NULL
                              CHECK (kind IN ('공지', '배정', '종료', '경고', '결과')),

  -- 06 「제목」 · 「내용」
  -- 서버가 만드는 문장이다. 푸시는 번역되지 않으므로 서버가 사용자 언어로 만들어 보낸다
  -- (08 · 11번). 관리자가 직접 쓴 공지는 쓴 그대로 나가고 번역하지 않는다 (05 P25).
  title           text        NOT NULL,
  body            text        NOT NULL,

  -- 06 「읽음 여부」
  is_read         boolean     NOT NULL DEFAULT false,

  -- 06 「받은 시각(30일까지만 보관)」 · 05 P14
  -- 화면에서 거르는 것이 아니라 서버 배치가 지운다 (08 · 5번 · 9번).
  received_at     timestamptz NOT NULL DEFAULT now()
);

-- 알림함 목록 · 안 읽은 개수 (05 P14 · 08 · 5번)
CREATE INDEX IF NOT EXISTS notifications_user_received_at_idx
  ON notifications (user_id, received_at DESC);

-- 30일 · 「공지」 3개월 삭제 배치 (05 P14 · 08 · 9번 · 0007). 배치는 사람을 가리지
-- 않고 받은 시각만 보므로 위의 (user_id, received_at) 인덱스가 쓰이지 않는다.
CREATE INDEX IF NOT EXISTS notifications_received_at_idx
  ON notifications (received_at);


-- -----------------------------------------------------------------------------
-- 8. 이용 내역  (06 「이용 내역」 · F13)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_history (
  history_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「누가」
  user_id    uuid        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- 06 「어느 기기」 — 기기가 지워져도 내역은 남는다
  machine_id uuid        NULL REFERENCES machines(machine_id) ON DELETE SET NULL,

  -- 06 「시작 시각」 · 「종료 시각」 — 줄서기가 끝난 뒤 한 줄로 남는다
  started_at timestamptz NOT NULL,
  ended_at   timestamptz NOT NULL,

  -- 06 「결과(완료 / 경고)」 · 05 상태값
  result     text        NOT NULL CHECK (result IN ('완료', '경고'))

  -- 06 「보관」은 칸이 아니라 규칙이다 — 3개월 또는 탈퇴 후 14일 중 먼저 오는 때에 삭제하고,
  -- 사생 기록 화면은 최근 30일만 보여준다 (05 P21 · SP4 · 08 · 9번).
);

-- 기록 화면 30일 · 관리자 3개월 조회 (05 P17 · P21)
CREATE INDEX IF NOT EXISTS usage_history_user_started_at_idx
  ON usage_history (user_id, started_at DESC);

-- 3개월 삭제 배치 (05 P17 · SP4 · 08 · 9번 · 0007). 배치는 사람을 가리지 않고 시작
-- 시각만 보므로 위의 (user_id, started_at) 인덱스가 쓰이지 않는다.
CREATE INDEX IF NOT EXISTS usage_history_started_at_idx
  ON usage_history (started_at);

-- 05 P6 · 0008 — 경고의 「사건 참조」. usage_history 뒤에 두는 이유는 warnings 표
-- 자체(4번)의 주석에 있다. 자동(P5 수거 미완료)·관리자(F28 「경고 주기」) 양쪽이
-- 같은 usage_history 행을 가리키면 아래 부분 UNIQUE 인덱스가 두 번째를 거부한다.
ALTER TABLE warnings
  ADD COLUMN IF NOT EXISTS usage_history_id uuid NULL
    REFERENCES usage_history(history_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS warnings_usage_history_id_idx
  ON warnings (usage_history_id)
  WHERE usage_history_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 9. 관리자 계정  (06 「관리자 계정」 · F30)
--    08 · 1번 — 관리자 로그인 화면에 문자열로 박혀 있는 아이디 · 비밀번호가 여기로 오고
--    클라이언트 코드에서는 지운다. 비밀번호는 해시로만 둔다.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_accounts (
  admin_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「아이디」 (예: eulji-university-dorm)
  login_id      text NOT NULL UNIQUE,

  -- 06 「비밀번호(행정실 발급)」 · 05 P12 · SP9
  -- 앱 안에서 재발급하지 않는다 — 기숙사 행정실(031-740-7700) 오프라인 처리만 지원한다.
  password_hash text NOT NULL

  -- [?] 관리자 계정이 여러 개가 될 수 있는지는 아직 열린 질문이다 (06 · 08 · 10번 · PRD 1절).
  --     표 구조는 여러 개를 담을 수 있게 두었고, 동별 담당자가 생기면 소속 칸이 더 필요해진다.
);


-- -----------------------------------------------------------------------------
-- 10. 푸시 구독  (06 「푸시 구독」 · F5 · F9 · F31 · F40)
--     08 · 6번 「기기별 구독 저장」 — 누구의 어느 기기로 보낼지
--     db/migrations/0001_push_subscriptions.sql 과 같은 내용이다
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


-- -----------------------------------------------------------------------------
-- 11. 공지  (06 「공지」 · F26 · F17)
--     관리자가 등록하면 사생 알림함의 "공지" 탭에 자동으로 반영된다 — 따로 발송하지
--     않는다. 관리자가 지우면 알림함에서도 사라진다 (05 P18).
--     db/migrations/0002_notices.sql 과 같은 내용이다
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notices (
  notice_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 06 「제목」 — 비어 있으면 등록할 수 없게 막는 것은 화면 몫이다 (F26)
  title      text        NOT NULL,

  -- 06 「내용」
  -- 관리자가 직접 쓰는 글이라 쓴 그대로 나가고 번역하지 않는다 (05 P25 · 08 · 11번).
  -- 다국어 공지가 필요해지면 관리자 화면에 언어별 입력칸이 먼저 생겨야 한다.
  body       text        NOT NULL,

  -- 06 「등록 시각」 — 06 「보관(등록 후 3개월 · P18)」의 기산점도 이 시각이다
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 06 에 없는 칸(작성자 · 수정 시각 · 노출 여부)은 만들지 않았다.
-- 관리자 계정이 여러 개가 될 수 있는지는 아직 열린 질문이라(06 의 [?]) 작성자 칸도 없다.

-- 관리자 목록 · 월 드롭다운 · 3개월 삭제 배치가 훑는 자리 (05 P18 · 08 · 9번)
-- 실제로 지우는 배치는 아직 없다 — 지금은 화면에서 거르기만 한다(PRD 6절).
-- 사생 알림함이 30일만 보여주는 것(05 P14)은 조회 규칙이라 3개월과 따로 논다 —
-- 지우는 기준은 둘 중 긴 3개월이다.
CREATE INDEX IF NOT EXISTS notices_created_at_idx
  ON notices (created_at DESC);


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

-- -----------------------------------------------------------------------------
-- 13. 알림 → 공지 연결  (0004 · 05 P18 · 06 「알림」 · 「공지」)
-- -----------------------------------------------------------------------------
-- 7번 notifications 는 11번 notices 보다 **먼저** 만들어진다. 그래서 이 외래키는
-- CREATE TABLE 안에 넣을 수 없고(아직 없는 표를 가리키게 된다), 두 표가 모두 선
-- 뒤인 여기에서 건다. 빈 DB 에 db:push 를 해도 순서가 맞는다.
--
-- 공지에서 나온 알림만 값이 있고 나머지는 NULL 이다. ON DELETE CASCADE 라
-- 공지를 지우면 그 공지가 만든 알림도 함께 사라진다 — 05 P18 의 "알림함에서도
-- 사라진다" 가 여기서 지켜진다.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notice_id uuid NULL
    REFERENCES notices(notice_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_notice_id_idx
  ON notifications (notice_id);

-- -----------------------------------------------------------------------------
-- 14. 신고 증거 사진  (0005 · 06 「신고」 → 「증거 사진」 · 05 P15 · P23 · 08 · 7번)
-- -----------------------------------------------------------------------------
-- 6번 reports 의 evidence_photo_url 이 가리키는 **파일 자체**가 여기 있다.
--
-- 08 · 7번이 말한 저장소를 외부(S3 등)가 아니라 DB 안에 둔다 — 이 저장소에는
-- 붙어 있는 외부 저장소도 credential 도 없어서, 지금 외부를 들이면 키가 생기기
-- 전까지 F11 이 통째로 동작하지 않는다. 증거 사진에는 남의 세탁물이 찍히므로
-- 주소만 알면 보이는 곳이 아니라 **권한을 보고 내려주는** 자리여야 하기도 하다
-- (/api/reports/[id]/evidence — 신고자 본인과 관리자만).
-- 외부 저장소로 옮길 때 고칠 곳은 src/lib/evidence-storage.ts 하나다.
--
-- 신고 1건에 사진 1장이다 — 07 설정 화면의 첨부 슬롯이 하나이고 06 「신고」의
-- 예시도 `(사진)` 한 장이다. 여러 장이 필요해지면 기본키를 따로 둔다.
CREATE TABLE IF NOT EXISTS report_evidence (
  -- 신고가 지워지면 사진도 함께 사라진다. users → reports 도 ON DELETE CASCADE 라
  -- 신고자가 지워지면 신고를 거쳐 사진까지 한 번에 사라진다 (05 P23 · P24).
  report_id    uuid        PRIMARY KEY REFERENCES reports(report_id) ON DELETE CASCADE,

  -- 서버가 실제 파일을 보고 정한 값만 들어온다.
  -- src/lib/report-rules.ts 의 ALLOWED_EVIDENCE_MIME 과 같은 집합이어야 한다.
  mime_type    text        NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),

  -- 실제로 읽은 바이트 수 — Content-Length 헤더가 아니다(그것은 위조된다)
  byte_size    integer     NOT NULL CHECK (byte_size > 0),

  -- 파일 자체. base64 로 실려 와 decode(..., 'base64') 로 들어간다.
  bytes        bytea       NOT NULL,

  -- 05 P23 「올린 시점부터 3개월」의 기산점
  uploaded_at  timestamptz NOT NULL DEFAULT now(),

  -- 05 P23 — **삭제 기준 시점을 행에 박아 둔다.** 보관 기간을 나중에 바꿔도 이미
  -- 올라온 사진은 올릴 때 약속한 시점에 지워진다. 배치는 이 칸만 본다.
  delete_after timestamptz NOT NULL
);

-- 3개월 삭제 배치가 훑는 자리 (05 P23 · 08 · 9번 · src/lib/cleanup.ts)
CREATE INDEX IF NOT EXISTS report_evidence_delete_after_idx
  ON report_evidence (delete_after);

-- 배치는 이 표의 행만 지우고 6번 reports 의 evidence_photo_url 은 그대로 둔다.
-- 그 칸까지 비우려면 reports_evidence_only_for_laundry_left CHECK 를 풀어야 하는데,
-- 그러면 P15 의 「사진 없이는 접수되지 않는다」를 DB 가 더는 지키지 못한다.
-- 접수 시점의 무결성이 보관 기간보다 앞선다 — 파일이 없어지면 서빙 라우트가 410 을
-- 돌려주고 화면에서 사진이 사라진다(P23 의 확인 방법 그대로다).

COMMIT;
