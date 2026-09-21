// 상태 전환 E2E 테스트용 DB 하네스 (Issue #58).
//
// ── 왜 진짜 Postgres 가 필요한가
// 이 저장소의 상태 전환은 거의 전부 **Postgres SQL 안에** 있다. neon-http 가 여러
// 문장에 걸친 BEGIN/COMMIT 을 지원하지 않아 "한 문장이 곧 한 트랜잭션" 으로 설계된
// 결과, drainQueue() · startUsageFromQr() · finishUsage() · expireOverdueAssignments()
// · transitionUsageToPickup() · expireOverduePickups() · applySystemWarning() 이 전부
// 데이터 수정 CTE 한 문장이다. 중복 경고 방지조차 부분 UNIQUE 인덱스(0008 · 0012)가
// 맡는다. 그래서 DB 를 mock 하면 **검증 대상이 통째로 사라진다.**
//
// ── 무엇을 쓰는가
// PGlite — 진짜 PostgreSQL 을 WASM 으로 컴파일한 것으로, 서버 프로세스 · 네트워크 ·
// 자격증명 없이 이 node 프로세스 안에서만 산다. 테스트마다 빈 DB 를 만들어
// db/schema.sql 을 그대로 적용하므로 운영 · Preview DB 를 건드릴 경로 자체가 없다.
// 테스트 러너는 node:test 그대로다 — 새 테스트 프레임워크가 아니다.
//
// ── 알려진 한계 (보고서에도 적는다)
//  · 연결이 하나라 **진짜 동시성**은 재현할 수 없다. FOR UPDATE · queue_machine_once_idx
//    의 경합 방어는 이 테스트의 범위가 아니고, 여기서 보는 것은 순차 반복 호출의 멱등성이다.
//  · 드라이버가 neon-http 가 아니다. SQL · 스키마 · 에러 코드(23505 + constraint 이름)는
//    같지만 드라이버 계층 자체를 검증하지는 않는다.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

import { clearExecutor, installExecutor } from './db-bridge.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'db', 'schema.sql');

/** db/schema.sql 은 한 번만 읽는다 (테스트마다 다시 읽을 이유가 없다) */
let schemaSql = null;

/**
 * 실수로라도 실제 DB · 외부 발송으로 나가지 못하게 환경변수를 지운다.
 *
 * `node --test` 는 .env 파일을 읽지 않으므로 평소에는 이 값들이 비어 있지만,
 * 셸에 남아 있거나 나중에 누군가 --env-file 을 붙일 수 있어 명시적으로 막는다.
 *   · DATABASE_URL / DATABASE_URL_UNPOOLED — 이 저장소의 .env.local 은 **Production**
 *     Neon branch 를 가리킨다. 지워 두면 neon 드라이버가 살아날 길이 없다
 *     (애초에 @/lib/db 가 test/db-bridge.mjs 로 바뀌어 로드조차 되지 않는다).
 *   · VAPID 3종 — push.ts::configured() 가 false 가 되어 웹푸시가 나가지 않는다.
 *     경고 · 배정 알림 경로가 notify() → sendPushToUser() 를 그대로 부르기 때문에
 *     이 차단이 없으면 테스트가 실제 구독자에게 푸시를 보낼 수 있다.
 *   · RESEND_API_KEY — 메일 발송 경로 차단.
 */
function scrubEnvironment() {
  for (const name of [
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'RESEND_API_KEY',
  ]) {
    delete process.env[name];
  }
}

/**
 * 빈 테스트 DB 를 하나 띄우고 `@/lib/db` 를 거기에 연결한다.
 *
 * 시나리오마다 새로 부르고 끝나면 close() 한다 — 테스트끼리 데이터가 섞이지 않고,
 * 넓은 범위 DELETE 로 치우는 일이 아예 필요 없다.
 */
export async function createTestDb() {
  scrubEnvironment();

  if (schemaSql === null) {
    schemaSql = await readFile(SCHEMA_PATH, 'utf8');
  }

  const pg = new PGlite();
  // schema.sql 자체가 BEGIN · COMMIT 을 들고 있어 전부 적용되거나 전부 안 된다
  // (scripts/db-push.mjs 가 실제 DB 에 적용하는 방식과 같다).
  await pg.exec(schemaSql);

  installExecutor(async (text, params) => {
    const result = await pg.query(text, params);
    return result.rows;
  });

  return {
    /**
     * 테스트가 상태를 **확인** 할 때 쓰는 직통 질의.
     * production 판정을 여기서 다시 쓰지 않는다 — 단정할 값을 읽어 오기만 한다.
     */
    async query(text, params = []) {
      const result = await pg.query(text, params);
      return result.rows;
    },
    async close() {
      clearExecutor();
      await pg.close();
    },
  };
}

// ── fixture 헬퍼 ─────────────────────────────────────────────────────────────
// 전부 "검증할 상황을 만드는" 도구다. 상태 전환 판정은 하나도 들어 있지 않다.

/**
 * 테스트 사용자 하나. 식별자에 issue58 표시를 넣어 실제 사용자와 겹치지 않게 한다
 * (이 DB 는 메모리에만 살지만 표시 규칙은 그대로 지킨다).
 */
export async function seedUser(db, label) {
  const rows = await db.query(
    `INSERT INTO users (name, email, signup_method, gender, school, student_id, room)
     VALUES ($1, $2, '이메일', '미지정', '테스트대학교', $3, 'issue58')
     RETURNING user_id`,
    [
      `issue58-${label}`,
      `issue58-${label}@test.ac.kr`,
      // 학번은 숫자만 12자리까지 — label 로 고유한 숫자를 만든다
      String(Date.now() % 100000000).padStart(8, '0') + String(nextSerial()).padStart(3, '0'),
    ],
  );
  return rows[0].user_id;
}

let serial = 0;
function nextSerial() {
  serial = (serial + 1) % 1000;
  return serial;
}

/** 기기 하나. kind 는 '세탁기' 또는 '건조기' */
export async function seedMachine(db, kind, name) {
  const rows = await db.query(
    `INSERT INTO machines (name, kind, status) VALUES ($1, $2, '사용가능') RETURNING machine_id`,
    [name, kind],
  );
  return rows[0].machine_id;
}

/**
 * 시간이 흐른 것처럼 만든다.
 *
 * drainQueue() · startUsageFromQr() · finishUsage() 는 DB 의 `now()` 로 시각을 찍고
 * `now` 주입 지점이 없다(그 의미를 바꾸는 리팩터링은 이번 Issue 범위 밖이다).
 * 그래서 **실제로 기다리는 대신 이미 만들어진 행의 시각을 과거로 옮긴다.** queue 와
 * machines 의 시각 칸을 같은 간격만큼 한꺼번에 당기므로 행들의 **상대 순서(FIFO)가
 * 그대로 보존**된다. NULL 은 빼기를 해도 NULL 이라 따로 가드가 필요 없다.
 *
 * 이렇게 해 두면 스윕은 cron 라우트와 **똑같이** 인자 없이 부를 수 있다
 * (`runExpirationSweep()` → 내부 기본값 `new Date()`).
 *
 * WHERE 가 없는 UPDATE 지만, 대상은 이 테스트 전용 메모리 DB 뿐이다 — 공용 DB 에
 * 조건 없는 UPDATE 를 돌리지 않는다는 규칙과 충돌하지 않는다.
 */
export async function advanceClock(db, interval) {
  await db.query(
    `UPDATE queue
        SET queued_at          = queued_at          - $1::interval,
            assigned_at        = assigned_at        - $1::interval,
            assign_deadline_at = assign_deadline_at - $1::interval,
            pickup_deadline_at = pickup_deadline_at - $1::interval`,
    [interval],
  );
  await db.query(`UPDATE machines SET ends_at = ends_at - $1::interval`, [interval]);
}
