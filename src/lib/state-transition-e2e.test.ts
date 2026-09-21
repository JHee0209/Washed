// 배정 · QR · 사용 · 수거 · 만료 상태 전환 E2E 회귀 테스트 (Issue #58).
//
// ── 이 파일이 있는 이유
// 핵심 흐름(줄서기 → 배정 → QR → 사용 → 종료 → 수거 → 다음 사용자)은 queue.status ·
// machines.status · machines.ends_at · queue.pickup_deadline_at 이 함께 움직인다.
// #8(자동 만료·경고) · #34(타이머 단일화) · #35(GET 부작용 분리) · #47(전체 점검)이
// 모두 같은 전환 코드를 건드리는데, 전환 전체를 재현하는 테스트가 없어서 한 Issue 의
// 수정이 다른 단계를 깨도 `npm test` 로 드러나지 않았다. 그 안전망이 여기다.
//
// ── 무엇을 부르는가
// **전부 production 코드다.** 줄서기 · QR · 다했어요는 실제 라우트 핸들러를 그대로
// 부르고(줄서기 게이트 SQL 과 종료 후 다음 사람 배정이 라우트 안에 있다), 만료는
// cron 라우트와 똑같이 runExpirationSweep() 을 인자 없이 부른다. 이 파일에는 상태
// 전환 SQL 이 한 줄도 없다 — 테스트가 구현을 복제하면 구현이 바뀌어도 테스트는 계속
// 통과해 안전망이 되지 못한다.
//
// ── 정책 값을 왜 여기 다시 적는가
// 아래 상수들은 assignment-rules.ts 에서 import 하지 않는다. import 하면 정책 값이
// 바뀔 때 테스트도 함께 따라가 **변경을 잡아내지 못한다.** 05 P3 · P5 가 약속한 숫자를
// 테스트가 독립적으로 고정하는 것이 이 파일의 목적이다.
//
// ── DB
// test/db-harness.mjs 가 띄우는 PGlite(인메모리 PostgreSQL)를 쓴다. 운영 · Preview DB
// 에는 어떤 읽기도 쓰기도 하지 않는다 — 하네스가 DATABASE_URL 을 지우고, @/lib/db 는
// 테스트 bridge 로 치환된다(test/resolve-hooks.mjs).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { POST as finishPost } from '../app/api/queue/finish/route.ts';
import { POST as verifyQrPost } from '../app/api/queue/verify-qr/route.ts';
import { POST as enqueuePost } from '../app/api/queue/[kind]/route.ts';
import { drainQueue } from './assignment.ts';
import { getFacilityStatus, updateFacilityInspection } from './facility-status.ts';
import { signMachineQr } from './qr.ts';
import { runExpirationSweep } from './scheduler.ts';
import { advanceClock, createTestDb, seedMachine, seedUser } from '../../test/db-harness.mjs';
import { loginAs } from '../../test/stubs/auth.mjs';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** 05 P3 — 배정 후 QR 인증 제한 시간 */
const ASSIGN_WINDOW_MINUTES = 10;
/** 05 P4 — 세탁기 사용 시간 */
const WASHER_RUN_MINUTES = 60;
/** 05 P4 — 건조기 사용 시간 */
const DRYER_RUN_MINUTES = 45;
/** 05 P5 — 수거 유예 */
const PICKUP_GRACE_MINUTES = 3;

const MINUTE_MS = 60_000;

// QR 라우트는 서명 검증을 하므로 비밀키가 있어야 한다. 테스트 전용 값이고 실제
// 스티커와 무관하다 (qr.test.ts 가 쓰는 방식과 같다).
process.env.QR_SIGNING_SECRET = 'issue58-state-transition-e2e-secret';

// ── 읽기 전용 상태 조회 ──────────────────────────────────────────────────────
// 단정할 값을 읽어 오기만 한다. 판정은 하지 않는다.

type QueueRow = {
  queue_id: string;
  user_id: string;
  machine_id: string | null;
  status: string;
  queued_at: Date;
  assigned_at: Date | null;
  assign_deadline_at: Date | null;
  pickup_deadline_at: Date | null;
};

async function queueRows(db: TestDb): Promise<QueueRow[]> {
  return (await db.query(
    `SELECT queue_id, user_id, machine_id, status, queued_at,
            assigned_at, assign_deadline_at, pickup_deadline_at
       FROM queue ORDER BY queued_at, queue_id`,
  )) as QueueRow[];
}

async function queueOf(db: TestDb, userId: string): Promise<QueueRow | null> {
  const rows = await queueRows(db);
  return rows.find((row) => row.user_id === userId) ?? null;
}

type MachineRow = { machine_id: string; name: string; kind: string; status: string; ends_at: Date | null };

async function machineOf(db: TestDb, machineId: string): Promise<MachineRow> {
  const rows = (await db.query(
    `SELECT machine_id, name, kind, status, ends_at FROM machines WHERE machine_id = $1`,
    [machineId],
  )) as MachineRow[];
  assert.ok(rows[0], '기기 행이 있어야 한다');
  return rows[0];
}

type WarningRow = {
  warning_id: string;
  user_id: string;
  reason: string;
  issued_by: string;
  incident_queue_id: string | null;
  usage_history_id: string | null;
};

async function warningsOf(db: TestDb, userId: string): Promise<WarningRow[]> {
  return (await db.query(
    `SELECT warning_id, user_id, reason, issued_by, incident_queue_id, usage_history_id
       FROM warnings WHERE user_id = $1 ORDER BY issued_at`,
    [userId],
  )) as WarningRow[];
}

type HistoryRow = {
  history_id: string;
  user_id: string;
  machine_id: string | null;
  started_at: Date;
  ended_at: Date;
  result: string;
  source_queue_id: string | null;
};

async function historyOf(db: TestDb, userId: string): Promise<HistoryRow[]> {
  return (await db.query(
    `SELECT history_id, user_id, machine_id, started_at, ended_at, result, source_queue_id
       FROM usage_history WHERE user_id = $1 ORDER BY started_at`,
    [userId],
  )) as HistoryRow[];
}

async function warningCountOf(db: TestDb, userId: string): Promise<number> {
  const rows = (await db.query(`SELECT warning_count FROM usage_restrictions WHERE user_id = $1`, [
    userId,
  ])) as { warning_count: number }[];
  return rows[0]?.warning_count ?? 0;
}

// ── production 경로 호출 (HTTP 배관만 감싼다) ───────────────────────────────

type RouteResult = { status: number; body: Record<string, unknown> };

/** POST /api/queue/[kind] — 줄서기 (게이트 · 지연평가 스윕 · 즉시 배정이 전부 이 안에 있다) */
async function enqueue(userId: string, kind: 'washer' | 'dryer'): Promise<RouteResult> {
  loginAs(userId);
  const res = await enqueuePost(new Request(`http://test/api/queue/${kind}`, { method: 'POST' }), {
    params: Promise.resolve({ kind }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** POST /api/queue/verify-qr — 기기에 붙은 서명 QR 을 그대로 만들어 인증한다 */
async function verifyQr(userId: string, machineId: string): Promise<RouteResult> {
  loginAs(userId);
  const res = await verifyQrPost(
    new Request('http://test/api/queue/verify-qr', {
      method: 'POST',
      body: JSON.stringify({ payload: signMachineQr(machineId) }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** POST /api/queue/finish — 다했어요 (종료 + 다음 사람 배정이 이 라우트 안에 있다) */
async function finish(userId: string, machineId: string): Promise<RouteResult> {
  loginAs(userId);
  const res = await finishPost(
    new Request('http://test/api/queue/finish', {
      method: 'POST',
      body: JSON.stringify({ machineId }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** 두 시각의 간격(분). 소수점까지 본다 — "정확히 10분" 을 단정하려는 것이다 */
function minutesBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / MINUTE_MS;
}

// ════════════════════════════════════════════════════════════════════════════
// 시나리오 1 — 정상 사용
// ════════════════════════════════════════════════════════════════════════════

describe('정상 사용', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;
  let machine: string;
  let queueIdA: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'normal-a');
    userB = await seedUser(db, 'normal-b');
    machine = await seedMachine(db, '세탁기', '세탁기 1');
  });

  after(async () => {
    await db.close();
  });

  it('A 줄서기 — 빈 기기가 있어 그 자리에서 배정된다', async () => {
    const res = await enqueue(userA, 'washer');
    assert.equal(res.status, 201, '줄서기는 201 이어야 한다');
    assert.equal(res.body.status, 'assigned', 'A 는 즉시 배정 상태여야 한다');

    const row = await queueOf(db, userA);
    assert.ok(row, 'A 의 queue 행이 있어야 한다');
    queueIdA = row.queue_id;
    assert.equal(row.status, '배정', 'queue.status 가 배정이어야 한다');
    assert.equal(row.machine_id, machine, 'A 의 queue 행이 그 기기를 가리켜야 한다');
    assert.ok(row.assigned_at, 'assigned_at 이 찍혀야 한다');
    assert.ok(row.assign_deadline_at, 'assign_deadline_at 이 찍혀야 한다');
    assert.equal(
      minutesBetween(row.assign_deadline_at, row.assigned_at),
      ASSIGN_WINDOW_MINUTES,
      `배정 마감은 배정 시각 + ${ASSIGN_WINDOW_MINUTES}분이어야 한다 (05 P3)`,
    );
    assert.equal(row.pickup_deadline_at, null, '배정 단계에는 수거 마감이 없어야 한다');
  });

  it('A 배정 직후 기기 — 사용중이지만 타이머는 아직 없다', async () => {
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용중', '배정된 기기는 사용중이어야 한다');
    assert.equal(m.ends_at, null, '타이머는 QR 인증에서 돌기 시작한다 (05 P4)');
  });

  it('B 줄서기 — 빈 기기가 없어 대기 중으로 남는다', async () => {
    const res = await enqueue(userB, 'washer');
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'waiting', 'B 는 대기 상태여야 한다');

    const row = await queueOf(db, userB);
    assert.ok(row, 'B 의 queue 행이 있어야 한다');
    assert.equal(row.status, '대기 중');
    assert.equal(row.machine_id, null, '대기 중인 줄에는 기기가 붙지 않아야 한다');
  });

  it('A QR 인증 — 사용중으로 바뀌고 타이머가 선다', async () => {
    const res = await verifyQr(userA, machine);
    assert.equal(res.status, 200, 'QR 인증은 200 이어야 한다');
    assert.equal(res.body.ok, true);

    const row = await queueOf(db, userA);
    assert.equal(row?.status, '사용중', 'queue.status 가 사용중이어야 한다');

    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용중');
    assert.ok(m.ends_at, 'QR 인증이 machines.ends_at 을 세워야 한다');
    const assignedAt = (await queueOf(db, userA))?.assigned_at;
    assert.ok(assignedAt);
    // ends_at 은 now() 기준이라 assigned_at 과 몇 ms 차이가 난다 — 60분에 가깝기만 하면 된다.
    const runMinutes = minutesBetween(m.ends_at, assignedAt);
    assert.ok(
      Math.abs(runMinutes - WASHER_RUN_MINUTES) < 1,
      `세탁기 타이머는 ${WASHER_RUN_MINUTES}분이어야 한다 (05 P4) — 실제 ${runMinutes}분`,
    );
  });

  it('B 는 A 가 쓰는 동안 그대로 대기 중이다', async () => {
    const row = await queueOf(db, userB);
    assert.equal(row?.status, '대기 중');
    assert.equal(row?.machine_id, null);
  });

  it('A 다했어요 — A 의 줄이 사라지고 이용 내역이 완료로 남는다', async () => {
    const res = await finish(userA, machine);
    assert.equal(res.status, 200, '다했어요는 200 이어야 한다');
    assert.equal(res.body.ok, true);

    assert.equal(await queueOf(db, userA), null, 'A 의 queue 행이 남아 있으면 안 된다');

    const history = await historyOf(db, userA);
    assert.equal(history.length, 1, 'A 의 이용 내역이 정확히 1건이어야 한다');
    assert.equal(history[0].result, '완료');
    assert.equal(history[0].machine_id, machine);
    assert.equal(
      history[0].source_queue_id,
      queueIdA,
      '이용 내역이 원래 줄서기 사건을 가리켜야 한다 (0013)',
    );
  });

  it('A 다했어요 직후 — 다음 사람 B 가 같은 기기에 배정된다', async () => {
    const row = await queueOf(db, userB);
    assert.equal(row?.status, '배정', 'B 가 배정으로 올라와야 한다');
    assert.equal(row?.machine_id, machine, 'B 가 A 가 쓰던 기기를 받아야 한다');
    assert.ok(row?.assigned_at && row.assign_deadline_at);
    assert.equal(
      minutesBetween(row.assign_deadline_at, row.assigned_at),
      ASSIGN_WINDOW_MINUTES,
      'B 의 배정 마감도 10분이어야 한다',
    );

    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용중', '기기가 B 에게 넘어가 사용중이어야 한다');
    assert.equal(m.ends_at, null, 'B 는 아직 QR 인증 전이라 타이머가 없어야 한다');
  });

  it('정상 종료에는 경고가 생기지 않는다', async () => {
    assert.equal((await warningsOf(db, userA)).length, 0, 'A 에게 경고가 없어야 한다');
    assert.equal((await warningsOf(db, userB)).length, 0, 'B 에게 경고가 없어야 한다');
  });

  it('queue 에는 B 의 줄 하나만 남는다', async () => {
    const rows = await queueRows(db);
    assert.equal(rows.length, 1, '이전 사용자가 queue 에 남아 있으면 안 된다');
    assert.equal(rows[0].user_id, userB);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 시나리오 2 — QR 미인증 (배정 10분 초과)
// ════════════════════════════════════════════════════════════════════════════

describe('QR 미인증', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;
  let machine: string;
  let queueIdA: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'qr-expire-a');
    userB = await seedUser(db, 'qr-expire-b');
    machine = await seedMachine(db, '세탁기', '세탁기 1');

    await enqueue(userA, 'washer'); // A 즉시 배정
    await enqueue(userB, 'washer'); // B 대기
    const row = await queueOf(db, userA);
    assert.ok(row);
    queueIdA = row.queue_id;
  });

  after(async () => {
    await db.close();
  });

  it('전제 — A 배정 · B 대기', async () => {
    assert.equal((await queueOf(db, userA))?.status, '배정');
    assert.equal((await queueOf(db, userB))?.status, '대기 중');
  });

  it(`${ASSIGN_WINDOW_MINUTES}분 이전에는 만료되지 않는다`, async () => {
    await advanceClock(db, '9 minutes 59 seconds');
    const result = await runExpirationSweep();

    assert.deepEqual(result.failed, [], '스윕 단계가 실패하면 안 된다');
    assert.equal(result.expiredAssignments, 0, '마감 전에는 만료가 0건이어야 한다');
    assert.equal((await queueOf(db, userA))?.status, '배정', 'A 는 아직 배정 상태여야 한다');
    assert.equal((await warningsOf(db, userA)).length, 0, '마감 전에는 경고가 없어야 한다');
    assert.equal((await queueOf(db, userB))?.status, '대기 중', 'B 는 아직 대기여야 한다');
  });

  it(`${ASSIGN_WINDOW_MINUTES}분을 넘기면 배정이 풀린다`, async () => {
    await advanceClock(db, '2 seconds'); // 누적 10분 1초
    const result = await runExpirationSweep();

    assert.deepEqual(result.failed, []);
    assert.equal(result.expiredAssignments, 1, '만료가 1건이어야 한다');
    assert.equal(await queueOf(db, userA), null, 'A 의 배정이 제거돼야 한다');
  });

  it('A 에게 「배정 후 미인증」 경고가 정확히 1회 생긴다', async () => {
    const warnings = await warningsOf(db, userA);
    assert.equal(warnings.length, 1, '경고는 1건이어야 한다');
    assert.equal(warnings[0].reason, '배정 후 미인증');
    assert.equal(warnings[0].issued_by, '시스템 자동');
    assert.equal(
      warnings[0].incident_queue_id,
      queueIdA,
      '경고가 A 의 원래 줄서기 사건을 가리켜야 한다 (0012)',
    );
    assert.equal(
      warnings[0].usage_history_id,
      null,
      '사용을 시작한 적이 없으므로 이용 내역 참조가 없어야 한다',
    );
    assert.equal(await warningCountOf(db, userA), 1, '누적 경고가 1회여야 한다');
  });

  it('사용을 시작한 적이 없으므로 이용 내역은 남지 않는다', async () => {
    assert.equal((await historyOf(db, userA)).length, 0);
  });

  it('다음 대기자 B 가 FIFO 순서대로 배정된다', async () => {
    const row = await queueOf(db, userB);
    assert.equal(row?.status, '배정', 'B 가 배정돼야 한다');
    assert.equal(row?.machine_id, machine);
    assert.ok(row?.assigned_at && row.assign_deadline_at);
    assert.equal(
      minutesBetween(row.assign_deadline_at, row.assigned_at),
      ASSIGN_WINDOW_MINUTES,
      'B 의 10분은 A 의 남은 시간이 아니라 새로 시작해야 한다',
    );
  });

  it('기기 상태가 B 의 배정과 맞고 ends_at 이 남지 않는다', async () => {
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용중');
    assert.equal(m.ends_at, null, '배정 단계의 기기에 타이머가 남아 있으면 안 된다');
  });

  it('queue 에는 B 의 줄 하나만 남는다', async () => {
    const rows = await queueRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, userB);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 시나리오 3 — 다음 사용자 없음
// ════════════════════════════════════════════════════════════════════════════

describe('다음 사용자 없음 · 배정 만료', () => {
  let db: TestDb;
  let userA: string;
  let machine: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'no-next-expire-a');
    machine = await seedMachine(db, '세탁기', '세탁기 1');
    await enqueue(userA, 'washer');
  });

  after(async () => {
    await db.close();
  });

  it('배정이 만료되고 대기자가 없다', async () => {
    await advanceClock(db, '10 minutes 1 second');
    const result = await runExpirationSweep();

    assert.deepEqual(result.failed, []);
    assert.equal(result.expiredAssignments, 1);
    assert.equal(result.assignedNext, 0, '대기자가 없으므로 새 배정이 없어야 한다');
  });

  it('queue 에 잘못된 배정 행이 남지 않는다', async () => {
    assert.deepEqual(await queueRows(db), [], 'queue 가 비어 있어야 한다');
  });

  it('기기가 사용가능으로 정상 반환된다', async () => {
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용가능', '기기가 반환돼야 한다');
    assert.equal(m.ends_at, null, 'ends_at 이 정리돼야 한다');
  });

  it('유령 사용자 참조가 남지 않는다', async () => {
    const orphans = (await db.query(
      `SELECT COUNT(*)::int AS n FROM queue WHERE machine_id = $1`,
      [machine],
    )) as { n: number }[];
    assert.equal(orphans[0].n, 0, '그 기기를 가리키는 queue 행이 없어야 한다');
  });
});

describe('다음 사용자 없음 · 사용 종료', () => {
  let db: TestDb;
  let userA: string;
  let machine: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'no-next-finish-a');
    machine = await seedMachine(db, '건조기', '건조기 1');
    await enqueue(userA, 'dryer');
    await verifyQr(userA, machine);
  });

  after(async () => {
    await db.close();
  });

  it('A 가 다했어요를 누르고 대기자가 없다', async () => {
    const res = await finish(userA, machine);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it('queue 가 비고 기기가 정상 반환된다', async () => {
    assert.deepEqual(await queueRows(db), []);
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용가능');
    assert.equal(m.ends_at, null);
  });

  it('이용 내역이 완료로 1건 남고 경고는 없다', async () => {
    const history = await historyOf(db, userA);
    assert.equal(history.length, 1);
    assert.equal(history[0].result, '완료');
    assert.equal((await warningsOf(db, userA)).length, 0);
  });

  it('스윕을 한 번 더 돌려도 아무 일이 없다', async () => {
    const result = await runExpirationSweep();
    assert.deepEqual(result.failed, []);
    assert.equal(result.expiredAssignments, 0);
    assert.equal(result.startedPickupWaits, 0);
    assert.equal(result.expiredPickups, 0);
    assert.equal(result.assignedNext, 0);

    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용가능');
    assert.equal(m.ends_at, null);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 시나리오 4 — 사용시간 만료 (세탁 60분 / 건조 45분) · 수거 유예 3분
// ════════════════════════════════════════════════════════════════════════════

/**
 * 세탁기와 건조기는 사용 시간만 다르고 이후 전환은 같다. 같은 단계 표를 두 번 쓰되
 * **중간 상태마다 스윕을 나눠** 확인한다 — 한 번에 끝까지 통과시키면 "사용중 →
 * 수거대기" 가 실제로 일어났는지, 아니면 건너뛰었는지 구별할 수 없다.
 */
function describeRunExpiry(kind: '세탁기' | '건조기', clientKind: 'washer' | 'dryer', runMinutes: number) {
  describe(`사용시간 만료 · ${kind} ${runMinutes}분`, () => {
    let db: TestDb;
    let userA: string;
    let userB: string;
    let machine: string;
    let queueIdA: string;
    let endsAt: Date;

    before(async () => {
      db = await createTestDb();
      userA = await seedUser(db, `run-${clientKind}-a`);
      userB = await seedUser(db, `run-${clientKind}-b`);
      machine = await seedMachine(db, kind, `${kind} 1`);

      await enqueue(userA, clientKind);
      await verifyQr(userA, machine);
      await enqueue(userB, clientKind);

      const row = await queueOf(db, userA);
      assert.ok(row);
      queueIdA = row.queue_id;
      endsAt = (await machineOf(db, machine)).ends_at as Date;
    });

    after(async () => {
      await db.close();
    });

    it('전제 — A 사용중 · B 대기 · 타이머 설정됨', async () => {
      assert.equal((await queueOf(db, userA))?.status, '사용중');
      assert.equal((await queueOf(db, userB))?.status, '대기 중');
      assert.ok(endsAt, 'machines.ends_at 이 있어야 한다');
    });

    it(`${runMinutes}분 이전에는 수거대기로 넘어가지 않는다`, async () => {
      await advanceClock(db, `${runMinutes - 1} minutes`);
      const result = await runExpirationSweep();

      assert.deepEqual(result.failed, []);
      assert.equal(result.startedPickupWaits, 0, '타이머 전에는 전환이 0건이어야 한다');
      assert.equal((await queueOf(db, userA))?.status, '사용중');
      assert.equal((await queueOf(db, userA))?.pickup_deadline_at, null);
    });

    it(`${runMinutes}분을 넘기면 수거대기로 넘어간다`, async () => {
      await advanceClock(db, '1 minute 1 second');
      const result = await runExpirationSweep();

      assert.deepEqual(result.failed, []);
      assert.equal(result.startedPickupWaits, 1, '수거대기 전환이 1건이어야 한다');
      assert.equal((await queueOf(db, userA))?.status, '수거대기');
    });

    it(`pickup_deadline_at 이 타이머 종료 + ${PICKUP_GRACE_MINUTES}분으로 찍힌다`, async () => {
      const row = await queueOf(db, userA);
      const machineRow = await machineOf(db, machine);
      assert.ok(row?.pickup_deadline_at, '수거 마감이 찍혀야 한다');
      assert.ok(machineRow.ends_at, '수거대기 동안에도 ends_at 은 남아 있어야 한다');
      assert.equal(
        minutesBetween(row.pickup_deadline_at, machineRow.ends_at),
        PICKUP_GRACE_MINUTES,
        `수거 마감은 타이머 0 + ${PICKUP_GRACE_MINUTES}분이어야 한다 (05 P5)`,
      );
    });

    it('수거대기 동안 기기는 여전히 사용중이다 (기기에는 수거대기 상태가 없다)', async () => {
      const m = await machineOf(db, machine);
      assert.equal(m.status, '사용중');
    });

    it('수거대기 중에는 다음 사람이 배정되지 않는다', async () => {
      assert.equal((await queueOf(db, userB))?.status, '대기 중', 'B 는 아직 대기여야 한다');
      assert.equal((await queueOf(db, userB))?.machine_id, null);
    });

    it(`${PICKUP_GRACE_MINUTES}분 이전에는 경고가 없다`, async () => {
      await advanceClock(db, `${PICKUP_GRACE_MINUTES - 1} minutes`);
      const result = await runExpirationSweep();

      assert.deepEqual(result.failed, []);
      assert.equal(result.expiredPickups, 0, '유예 전에는 강제 종료가 0건이어야 한다');
      assert.equal((await queueOf(db, userA))?.status, '수거대기');
      assert.equal((await warningsOf(db, userA)).length, 0, '유예 전에는 경고가 없어야 한다');
    });

    it(`${PICKUP_GRACE_MINUTES}분을 넘기면 강제 종료된다`, async () => {
      await advanceClock(db, '1 minute 1 second');
      const result = await runExpirationSweep();

      assert.deepEqual(result.failed, []);
      assert.equal(result.expiredPickups, 1, '강제 종료가 1건이어야 한다');
      assert.equal(await queueOf(db, userA), null, 'A 의 줄이 사라져야 한다');
    });

    it('A 에게 「수거 미완료」 경고가 정확히 1회 생긴다', async () => {
      const warnings = await warningsOf(db, userA);
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0].reason, '수거 미완료');
      assert.equal(warnings[0].issued_by, '시스템 자동');
      assert.equal(warnings[0].incident_queue_id, queueIdA);
      assert.ok(warnings[0].usage_history_id, '강제 종료 이용 내역을 가리켜야 한다 (0008)');
      assert.equal(await warningCountOf(db, userA), 1);
    });

    it(`이용 내역이 경고로 남고 시작 시각을 ends_at 에서 ${runMinutes}분 되짚는다`, async () => {
      const history = await historyOf(db, userA);
      assert.equal(history.length, 1);
      assert.equal(history[0].result, '경고');
      assert.equal(history[0].source_queue_id, queueIdA);
      assert.equal(
        minutesBetween(history[0].ended_at, history[0].started_at),
        runMinutes + PICKUP_GRACE_MINUTES,
        `이용 내역은 시작(타이머 ${runMinutes}분 전)부터 수거 마감까지여야 한다`,
      );
    });

    it('다음 대기자 B 가 배정되고 기기는 B 것이 된다', async () => {
      const row = await queueOf(db, userB);
      assert.equal(row?.status, '배정');
      assert.equal(row?.machine_id, machine);

      const m = await machineOf(db, machine);
      assert.equal(m.status, '사용중');
      assert.equal(m.ends_at, null, 'B 는 QR 인증 전이라 타이머가 없어야 한다');
    });
  });
}

describeRunExpiry('세탁기', 'washer', WASHER_RUN_MINUTES);
describeRunExpiry('건조기', 'dryer', DRYER_RUN_MINUTES);

// ════════════════════════════════════════════════════════════════════════════
// 시나리오 5 — scheduler 멱등성
// ════════════════════════════════════════════════════════════════════════════

describe('scheduler 멱등성', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;
  let userC: string;
  let machine: string;
  let firstAssignedAt: Date;
  let firstDeadline: Date;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'idem-a');
    userB = await seedUser(db, 'idem-b');
    userC = await seedUser(db, 'idem-c');
    machine = await seedMachine(db, '세탁기', '세탁기 1');

    // A 사용중, B · C 대기 (B 가 먼저 줄을 섰다)
    await enqueue(userA, 'washer');
    await verifyQr(userA, machine);
    await enqueue(userB, 'washer');
    await enqueue(userC, 'washer');

    // 타이머도 끝나고 수거 유예도 지난 시점까지 한 번에 당긴다
    await advanceClock(db, `${WASHER_RUN_MINUTES + PICKUP_GRACE_MINUTES} minutes 1 second`);
  });

  after(async () => {
    await db.close();
  });

  it('1회차 — 한 스윕 안에서 수거대기를 거쳐 강제 종료까지 간다', async () => {
    const result = await runExpirationSweep();

    assert.deepEqual(result.failed, []);
    assert.equal(result.startedPickupWaits, 1, '사용중 → 수거대기 1건');
    assert.equal(result.expiredPickups, 1, '수거대기 → 강제 종료 1건');
    assert.equal(result.assignedNext, 1, '다음 사람 1명 배정');

    const row = await queueOf(db, userB);
    assert.ok(row?.assigned_at && row.assign_deadline_at);
    firstAssignedAt = row.assigned_at;
    firstDeadline = row.assign_deadline_at;
  });

  it('1회차 후 — B 가 배정되고 C 는 대기다 (FIFO)', async () => {
    assert.equal((await queueOf(db, userB))?.status, '배정', '먼저 줄 선 B 가 배정돼야 한다');
    assert.equal((await queueOf(db, userC))?.status, '대기 중', 'C 는 아직 대기여야 한다');
  });

  it('2회차 · 3회차 — 아무 일도 일어나지 않는다', async () => {
    for (const round of [2, 3]) {
      const result = await runExpirationSweep();
      assert.deepEqual(result.failed, [], `${round}회차 실패 단계가 없어야 한다`);
      assert.equal(result.expiredAssignments, 0, `${round}회차 배정 만료 0건`);
      assert.equal(result.startedPickupWaits, 0, `${round}회차 수거대기 전환 0건`);
      assert.equal(result.expiredPickups, 0, `${round}회차 강제 종료 0건`);
      assert.equal(result.assignedNext, 0, `${round}회차 신규 배정 0건`);
    }
  });

  it('동일 사유 경고가 중복 생성되지 않는다', async () => {
    const warnings = await warningsOf(db, userA);
    assert.equal(warnings.length, 1, '스윕을 3번 돌려도 경고는 1건이어야 한다');
    assert.equal(warnings[0].reason, '수거 미완료');
    assert.equal(await warningCountOf(db, userA), 1, '누적 경고도 1회여야 한다');
  });

  it('이용 내역이 중복 생성되지 않는다', async () => {
    assert.equal((await historyOf(db, userA)).length, 1);
  });

  it('queue 중복 행이 없고 한 기기에 한 줄만 붙는다', async () => {
    const rows = await queueRows(db);
    assert.equal(rows.length, 2, 'B · C 두 줄만 남아야 한다');

    const onMachine = rows.filter((row) => row.machine_id === machine);
    assert.equal(onMachine.length, 1, '한 기기에 두 사람이 붙으면 안 된다');
    assert.equal(onMachine[0].user_id, userB);

    const userIds = rows.map((row) => row.user_id);
    assert.equal(new Set(userIds).size, userIds.length, '같은 사용자가 두 줄을 가지면 안 된다');
  });

  it('assign_deadline_at 이 반복 실행 때마다 밀리지 않는다', async () => {
    const row = await queueOf(db, userB);
    assert.equal(
      row?.assigned_at?.getTime(),
      firstAssignedAt.getTime(),
      '배정 시각이 스윕마다 갱신되면 안 된다',
    );
    assert.equal(
      row?.assign_deadline_at?.getTime(),
      firstDeadline.getTime(),
      '배정 마감이 스윕마다 밀리면 안 된다',
    );
  });

  it('FIFO 순서가 바뀌지 않는다', async () => {
    const rows = await queueRows(db);
    assert.deepEqual(
      rows.map((row) => row.user_id),
      [userB, userC],
      '줄 선 순서가 유지돼야 한다',
    );
  });

  it('ends_at 이 이상하게 남지 않는다', async () => {
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용중', 'B 에게 배정된 상태여야 한다');
    assert.equal(m.ends_at, null, 'QR 인증 전이므로 타이머가 없어야 한다');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 시나리오 6 — 세탁실 전체 점검 (Issue #47 · 05 P20)
// ════════════════════════════════════════════════════════════════════════════

describe('전체 점검 ON/OFF', () => {
  let db: TestDb;
  let userA: string;
  let userB: string;
  let userC: string;
  let machine: string;

  before(async () => {
    db = await createTestDb();
    userA = await seedUser(db, 'inspect-a');
    userB = await seedUser(db, 'inspect-b');
    userC = await seedUser(db, 'inspect-c');
    machine = await seedMachine(db, '세탁기', '세탁기 1');

    // A 는 사용중, C 는 점검이 켜지기 전부터 대기 중이다
    await enqueue(userA, 'washer');
    await verifyQr(userA, machine);
    await enqueue(userC, 'washer');
  });

  after(async () => {
    await db.close();
  });

  it('전제 — A 사용중 · C 대기 중', async () => {
    assert.equal((await queueOf(db, userA))?.status, '사용중');
    assert.equal((await queueOf(db, userC))?.status, '대기 중');
  });

  it('점검을 켠다', async () => {
    const status = await updateFacilityInspection(true);
    assert.equal(status.isUnderInspection, true);
    assert.equal((await getFacilityStatus()).isUnderInspection, true);
  });

  it('점검 중에는 신규 줄서기가 막힌다', async () => {
    const res = await enqueue(userB, 'washer');
    assert.equal(res.status, 409, '점검 중 줄서기는 409 여야 한다');
    assert.equal(res.body.reason, 'facility_inspection');
    assert.equal(await queueOf(db, userB), null, 'B 의 줄이 만들어지면 안 된다');
  });

  it('점검 중에는 신규 배정이 막힌다', async () => {
    const assigned = await drainQueue();
    assert.equal(assigned.length, 0, '점검 중에는 배정이 0건이어야 한다');
    assert.equal((await queueOf(db, userC))?.status, '대기 중', 'C 는 대기에 머물러야 한다');
    assert.equal((await queueOf(db, userC))?.machine_id, null);
  });

  it('점검 중에도 기존 사용 세션은 정상 종료된다 (05 P20)', async () => {
    const res = await finish(userA, machine);
    assert.equal(res.status, 200, '이미 사용 중이던 사람은 끝낼 수 있어야 한다');
    assert.equal(res.body.ok, true);
    assert.equal(await queueOf(db, userA), null);

    const history = await historyOf(db, userA);
    assert.equal(history.length, 1);
    assert.equal(history[0].result, '완료');
  });

  it('종료로 빈 기기가 생겨도 점검 중에는 다음 사람이 배정되지 않는다', async () => {
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용가능', '기기는 반환돼야 한다');
    assert.equal(m.ends_at, null);
    assert.equal((await queueOf(db, userC))?.status, '대기 중', 'C 는 여전히 대기여야 한다');
  });

  it('점검 중 스윕을 돌려도 배정이 생기지 않는다', async () => {
    const result = await runExpirationSweep();
    assert.deepEqual(result.failed, []);
    assert.equal(result.assignedNext, 0);
    assert.equal((await queueOf(db, userC))?.status, '대기 중');
  });

  it('점검을 끈다', async () => {
    const status = await updateFacilityInspection(false);
    assert.equal(status.isUnderInspection, false);
  });

  it('점검을 끄면 FIFO 가 그대로 재개된다', async () => {
    const assigned = await drainQueue();
    assert.equal(assigned.length, 1, '대기하던 C 가 배정돼야 한다');
    assert.equal(assigned[0].user_id, userC);

    const row = await queueOf(db, userC);
    assert.equal(row?.status, '배정');
    assert.equal(row?.machine_id, machine);
    assert.ok(row?.assigned_at && row.assign_deadline_at);
    assert.equal(
      minutesBetween(row.assign_deadline_at, row.assigned_at),
      ASSIGN_WINDOW_MINUTES,
      '점검이 끝난 뒤 받은 배정도 10분이어야 한다',
    );
  });

  it('점검 이후에도 신규 줄서기가 다시 가능하다', async () => {
    const res = await enqueue(userB, 'washer');
    assert.equal(res.status, 201, '점검이 끝나면 줄을 설 수 있어야 한다');
    assert.equal(res.body.status, 'waiting', '빈 기기가 없으므로 대기여야 한다');
  });

  it('점검 때문에 machine · queue 가 꼬이지 않는다', async () => {
    const m = await machineOf(db, machine);
    assert.equal(m.status, '사용중', 'C 에게 배정돼 사용중이어야 한다');
    assert.equal(m.ends_at, null);

    const rows = await queueRows(db);
    assert.equal(rows.length, 2, 'C · B 두 줄만 있어야 한다');
    assert.equal(rows.filter((row) => row.machine_id === machine).length, 1);
    assert.deepEqual(
      rows.map((row) => row.user_id),
      [userC, userB],
      '줄 선 순서가 유지돼야 한다',
    );
  });
});
