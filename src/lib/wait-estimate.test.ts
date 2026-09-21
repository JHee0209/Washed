// 종류별 예상 배정 시각 회귀 테스트 (Issue #85).
//
// ── 이 파일이 있는 이유
// 화면의 "약 M:SS 후 배정"은 kindWaitEstimates() 한 함수가 정한다. 그런데 기기가 실제로
// 다음 사람에게 넘어가는 시각은 타이머가 0 이 되는 `machines.ends_at` 이 아니라, 05 P5 의
// 수거 유예가 끝나는 `ends_at + 3분`(= expiration.ts 가 찍는 pickup_deadline_at)이다.
// 그 유예가 빠져 있어 **표시와 실제 전환이 3분 어긋나 있었고**, 수거대기 동안 기기의
// status 는 그대로 '사용중' 이라 MIN 후보에 남는 탓에 카운트다운이 0:00 에 굳어 버렸다.
// 이 조회에는 그때까지 테스트가 하나도 없었다 — 그 안전망이 여기다.
//
// ── 무엇을 부르는가
// **production 코드다.** SQL 을 테스트에 옮겨 적지 않는다 — 구현을 복제하면 구현이 바뀌어도
// 테스트가 계속 통과해 안전망이 되지 못한다. db.query() 는 상황을 만들고 결과를 되읽는
// 데에만 쓰고, 판정은 한 줄도 하지 않는다.
//
// ── 정책 값을 왜 여기 다시 적는가
// state-transition-e2e.test.ts 와 같은 이유다. assignment-rules.ts 에서 import 하면 정책
// 값이 바뀔 때 테스트도 함께 따라가 **변경을 잡아내지 못한다.** 05 P5 가 약속한 3분을
// 테스트가 독립적으로 고정하는 것이 목적이다.
//
// ── 시각
// 벽시계 시각을 하나도 적지 않는다. 상황은 전부 DB 의 `now()` 기준 상대 간격으로 만들고,
// 단정은 그 기기의 ends_at 을 DB 에서 되읽어 거기서 파생시킨다.
//
// ── DB
// test/db-harness.mjs 가 띄우는 PGlite(인메모리 PostgreSQL)를 쓴다. 운영 · Preview DB 에는
// 어떤 읽기도 쓰기도 하지 않는다 — 하네스가 DATABASE_URL 을 지우고, @/lib/db 는 테스트
// bridge 로 치환된다(test/resolve-hooks.mjs).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { transitionFinishedUsageToPickup } from './expiration.ts';
import { kindWaitEstimates } from './queries.ts';
import { createTestDb, seedMachine, seedUser } from '../../test/db-harness.mjs';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** 05 P5 — 수거 유예 */
const PICKUP_GRACE_MINUTES = 3;

const MINUTE_MS = 60_000;

/** timestamptz 는 드라이버에 따라 string 으로도 Date 로도 온다 — 밀리초로만 비교한다 */
function ms(value: unknown): number {
  return new Date(value as string).getTime();
}

// ── 상황 만들기 ──────────────────────────────────────────────────────────────
// 전부 fixture 다. 상태 전환 판정은 하나도 들어 있지 않다.

/**
 * 기기를 「사용중」으로 만든다. `endsInMinutes` 가 음수면 타이머가 이미 지난 것이고,
 * 그때도 machines.status 는 '사용중' 그대로다 — 기기에는 '수거대기' 상태값이 없다.
 */
async function startRun(db: TestDb, machineId: string, endsInMinutes: number) {
  await db.query(
    `UPDATE machines
        SET status = '사용중', ends_at = now() + ($1::int * interval '1 minute')
      WHERE machine_id = $2`,
    [endsInMinutes, machineId],
  );
}

/** 배정만 되고 QR 인증 전 — 기기는 잠겨 '사용중' 이지만 ends_at 이 아직 없다 */
async function lockForAssignment(db: TestDb, machineId: string) {
  await db.query(
    `UPDATE machines SET status = '사용중', ends_at = NULL WHERE machine_id = $1`,
    [machineId],
  );
}

async function setStatus(db: TestDb, machineId: string, status: string) {
  await db.query(`UPDATE machines SET status = $1 WHERE machine_id = $2`, [status, machineId]);
}

async function endsAtOf(db: TestDb, machineId: string): Promise<number> {
  const rows = await db.query(`SELECT ends_at FROM machines WHERE machine_id = $1`, [machineId]);
  return ms(rows[0].ends_at);
}

// ── 단정 도우미 ──────────────────────────────────────────────────────────────

function assertGraceAfter(actual: string | null, endsAtMs: number, message: string) {
  assert.notEqual(actual, null, `${message} — 값이 null 이면 화면이 카운트다운을 그리지 않는다`);
  assert.equal(ms(actual), endsAtMs + PICKUP_GRACE_MINUTES * MINUTE_MS, message);
}

// ── 1 · 2 · 5. 같은 종류 중 가장 먼저 끝나는 기기 + 수거 유예 ────────────────

describe('05 P2 · P5 — 예상 배정 시각은 「가장 먼저 끝나는 타이머 + 수거 유예」다 (Issue #85)', () => {
  let db: TestDb;
  let soonestWasher: string;
  let soonestDryer: string;

  before(async () => {
    db = await createTestDb();
    // 세탁기 3대 — 끝나는 순서를 일부러 섞어 심는다 (MIN 이 정렬에 기대지 않는지 본다)
    const w2 = await seedMachine(db, '세탁기', '세탁기 2호');
    soonestWasher = await seedMachine(db, '세탁기', '세탁기 1호');
    const w3 = await seedMachine(db, '세탁기', '세탁기 3호');
    await startRun(db, w2, 25);
    await startRun(db, soonestWasher, 10);
    await startRun(db, w3, 40);
    // 건조기 2대
    const d2 = await seedMachine(db, '건조기', '건조기 2호');
    soonestDryer = await seedMachine(db, '건조기', '건조기 1호');
    await startRun(db, d2, 30);
    await startRun(db, soonestDryer, 7);
  });

  after(async () => {
    await db.close();
  });

  it('세탁기 — 가장 빠른 ends_at 에 유예를 더한 시각을 준다', async () => {
    const { byKind } = await kindWaitEstimates();
    assertGraceAfter(
      byKind['세탁기'],
      await endsAtOf(db, soonestWasher),
      `가장 먼저 끝나는 세탁기의 종료 + ${PICKUP_GRACE_MINUTES}분이어야 한다 (05 P2 · P5)`,
    );
  });

  it('건조기 — 건조기끼리만 세고, 마찬가지로 유예를 더한다', async () => {
    const { byKind } = await kindWaitEstimates();
    assertGraceAfter(
      byKind['건조기'],
      await endsAtOf(db, soonestDryer),
      `가장 먼저 끝나는 건조기의 종료 + ${PICKUP_GRACE_MINUTES}분이어야 한다 (05 P2 · P5)`,
    );
  });

  it('두 종류가 섞이지 않는다 — 건조기가 더 빨라도 세탁기 값이 끌려가지 않는다', async () => {
    const { byKind } = await kindWaitEstimates();
    // 건조기 쪽이 7분으로 더 빠른데, 세탁기 값은 10분짜리 세탁기를 본다 (05 P1)
    assert.notEqual(ms(byKind['세탁기']), ms(byKind['건조기']));
    assert.equal(ms(byKind['세탁기']), (await endsAtOf(db, soonestWasher)) + PICKUP_GRACE_MINUTES * MINUTE_MS);
  });
});

describe('05 P5 — 같은 시각에 끝나는 기기가 여럿이어도 유예는 한 번만 더해진다', () => {
  let db: TestDb;
  let machineId: string;

  before(async () => {
    db = await createTestDb();
    machineId = await seedMachine(db, '세탁기', '세탁기 1호');
    const twin = await seedMachine(db, '세탁기', '세탁기 2호');
    await startRun(db, machineId, 15);
    // 두 대의 ends_at 을 정확히 같게 맞춘다
    await db.query(
      `UPDATE machines SET status = '사용중',
              ends_at = (SELECT ends_at FROM machines WHERE machine_id = $1)
        WHERE machine_id = $2`,
      [machineId, twin],
    );
  });

  after(async () => {
    await db.close();
  });

  it('동점이면 그 시각 + 유예 한 번이다', async () => {
    const { byKind } = await kindWaitEstimates();
    assertGraceAfter(
      byKind['세탁기'],
      await endsAtOf(db, machineId),
      '같은 ends_at 이 여러 대여도 유예는 한 번만 더한다',
    );
  });
});

// ── 3. 즉시 사용 가능한 기기가 있으면 유예를 붙이지 않는다 ───────────────────

describe('05 P2 — 바로 쓸 수 있는 기기가 있으면 유예를 더하지 않는다 (Issue #85)', () => {
  let db: TestDb;
  let running: string;

  before(async () => {
    db = await createTestDb();
    // 한 대는 비어 있고, 한 대는 돌아가는 중이다
    await seedMachine(db, '세탁기', '세탁기 1호');
    running = await seedMachine(db, '세탁기', '세탁기 2호');
    await startRun(db, running, 20);
  });

  after(async () => {
    await db.close();
  });

  it('서버의 지금 시각을 그대로 준다 — 돌아가는 기기의 종료 + 유예가 아니다', async () => {
    const { byKind, serverNow } = await kindWaitEstimates();
    assert.equal(
      ms(byKind['세탁기']),
      ms(serverNow),
      '빈 기기가 있으면 기다릴 이유가 없다 — 같은 질의의 now() 와 같아야 한다',
    );
    assert.notEqual(
      ms(byKind['세탁기']),
      (await endsAtOf(db, running)) + PICKUP_GRACE_MINUTES * MINUTE_MS,
      '빈 기기가 있는데 돌아가는 기기에 유예를 더해 기다리게 하면 안 된다',
    );
  });

  it('빈 기기가 없는 다른 종류는 영향을 받지 않는다', async () => {
    const dryer = await seedMachine(db, '건조기', '건조기 1호');
    await startRun(db, dryer, 12);
    const { byKind } = await kindWaitEstimates();
    assertGraceAfter(byKind['건조기'], await endsAtOf(db, dryer), '건조기는 빈 기기가 없으므로 유예를 더한다');
  });
});

// ── 8. 수거대기 — 원래 버그의 회귀 가드 ──────────────────────────────────────

describe('05 P5 — 타이머가 끝난 기기는 유예가 남은 만큼 아직 내 차례가 아니다 (Issue #85)', () => {
  let db: TestDb;
  let machineId: string;

  before(async () => {
    db = await createTestDb();
    machineId = await seedMachine(db, '세탁기', '세탁기 1호');
    // 타이머는 1분 전에 끝났지만 아직 수거 유예 중이다 (status 는 '사용중' 그대로)
    await startRun(db, machineId, -1);
  });

  after(async () => {
    await db.close();
  });

  it('ends_at 이 지났어도 유예가 남아 있으면 미래 시각을 준다', async () => {
    const { byKind, serverNow } = await kindWaitEstimates();
    assertGraceAfter(byKind['세탁기'], await endsAtOf(db, machineId), '수거대기 중에도 기준은 ends_at + 유예다');
    assert.ok(
      ms(byKind['세탁기']) > ms(serverNow),
      '유예가 남았는데 과거 시각을 주면 화면이 0:00 에 굳는다 — 이것이 Issue #85 의 증상이다',
    );
  });
});

// ── 6 · 7. 계산할 수 없을 때는 지어내지 않는다 ───────────────────────────────

describe('05 P2 — 예상 시각을 알 수 없으면 null 이다 (기존 fallback 유지)', () => {
  let db: TestDb;

  before(async () => {
    db = await createTestDb();
  });

  after(async () => {
    await db.close();
  });

  it('기기가 한 대도 없으면 두 종류 다 null 이다', async () => {
    const { byKind } = await kindWaitEstimates();
    assert.equal(byKind['세탁기'], null);
    assert.equal(byKind['건조기'], null);
  });

  it('전부 고장 · 점검중이면 null 이다 — 언제 빌지 알 수 없다', async () => {
    const broken = await seedMachine(db, '세탁기', '세탁기 1호');
    const underCheck = await seedMachine(db, '세탁기', '세탁기 2호');
    await setStatus(db, broken, '고장');
    await setStatus(db, underCheck, '점검중');
    const { byKind } = await kindWaitEstimates();
    assert.equal(byKind['세탁기'], null);
  });

  it('배정만 되고 QR 인증 전인 기기(ends_at 없음)는 기준이 되지 못한다', async () => {
    const assigned = await seedMachine(db, '건조기', '건조기 1호');
    await lockForAssignment(db, assigned);
    const { byKind } = await kindWaitEstimates();
    assert.equal(
      byKind['건조기'],
      null,
      '종료 예정 시각이 없으면 유예를 더할 기준도 없다 — 숫자를 지어내지 않는다',
    );
  });
});

// ── 9. 예상 표시와 실제 상태 전환이 같은 시각을 가리킨다 ─────────────────────

describe('Issue #85 — 예상 시각이 실제 수거 마감과 정확히 같다', () => {
  let db: TestDb;
  let machineId: string;
  let queueId: string;

  before(async () => {
    db = await createTestDb();
    const userId = await seedUser(db, 'wait-estimate');
    machineId = await seedMachine(db, '세탁기', '세탁기 1호');
    await startRun(db, machineId, -1);
    const rows = await db.query(
      `INSERT INTO queue (user_id, machine_kind, machine_id, status, queued_at, assigned_at)
       VALUES ($1, '세탁기', $2, '사용중', now() - interval '65 minutes', now() - interval '61 minutes')
       RETURNING queue_id`,
      [userId, machineId],
    );
    queueId = rows[0].queue_id;
    // production 의 전환을 그대로 돌린다 — 테스트가 pickup_deadline_at 을 직접 찍지 않는다
    await transitionFinishedUsageToPickup();
  });

  after(async () => {
    await db.close();
  });

  it('kindWaitEstimates() 가 준 시각 == expiration.ts 가 찍은 pickup_deadline_at', async () => {
    const rows = await db.query(`SELECT status, pickup_deadline_at FROM queue WHERE queue_id = $1`, [
      queueId,
    ]);
    assert.equal(rows[0].status, '수거대기', '전환이 실제로 일어났어야 이 단정에 뜻이 있다');

    const { byKind } = await kindWaitEstimates();
    assert.equal(
      ms(byKind['세탁기']),
      ms(rows[0].pickup_deadline_at),
      '화면이 보여 주는 예상 시각과 서버가 기기를 놓아 주는 시각은 같은 값이어야 한다',
    );
  });
});
