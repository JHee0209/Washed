// F3 · F4 · F7 — 줄서기 · 줄 빠지기 (05 P1 · P2 · P3 · P7 · P8 · P20 · P24).
//
// **배정 판정은 여기 없다.** 05 P2 의 「줄 선 순서대로 · 가장 먼저 끝나는 기기」는
// src/lib/assignment.ts 의 drainQueue() 한 곳에 있고, 이 라우트는 줄을 세운 뒤
// 그것을 부른 결과를 옮길 뿐이다 (08 · 3번 — 「배정은 서버가 정하고 클라이언트는
// 결과만 받는다」).
//
// ── 줄서기가 두 걸음인 이유 (Issue #5 에서 바뀐 곳)
// 예전에는 INSERT 하면서 빈 기기를 그 자리에서 가져갔다. 그러면 `queue` 를 보지
// 않고 기기를 집기 때문에, **먼저 줄을 서서 기다리던 사람을 뒤늦게 누른 사람이
// 가로챈다**(05 P2 「줄 선 순서대로」 위반). 그래서 지금은 누구든 일단 `대기 중`
// 으로 들어가고, 배정은 drainQueue() 가 줄 전체를 보고 정한다. 빈 기기가 있고 내
// 앞에 아무도 없으면 같은 요청 안에서 곧바로 배정돼 돌아온다(F4 는 그대로다).
//
// src/lib/db.ts 의 neon 드라이버는 여러 쿼리에 걸친 BEGIN/COMMIT 을 지원하지 않으므로
// 두 걸음 각각이 한 문장이다. 사이에서 요청이 끊겨도 `대기 중` 으로 남아 있다가 다음
// 배정 때 이어진다 — 어긋난 상태가 남지 않는다.
//
// ── 만료 스윕도 여기서 부른다 (Issue #8 에서 더해진 곳)
// assignment.ts 의 머리말이 「빈 기기 × 대기자가 바뀌는 자리에서만 부른다 — 줄서기
// (api/queue/[kind]) · 관리자의 대기열 빼기와 강제 사용가능」이라 적어 둔 곳이 여기다.
// expireOverdueAssignments()(05 P3)를 배정 판정 **앞에** 불러, 10분을 넘겨 방치된
// 배정을 먼저 풀고 그 기기를 이 요청의 drainQueue() 가 곧바로 쓸 수 있게 한다 —
// cleanup.ts 의 하루 1회 배치는 트래픽이 없을 때의 백스톱일 뿐이다.

import 'server-only';
import { auth } from '@/auth';
import { withdrawPendingBlock } from '@/lib/account-guard';
import { drainQueue } from '@/lib/assignment';
import { sql } from '@/lib/db';
import { expireOverdueAssignments } from '@/lib/expiration';
import { isMachineKind, MachineKind } from '@/lib/report-rules';
import { NextResponse } from 'next/server';

type ClientKind = 'washer' | 'dryer';

const CLIENT_KIND_TO_DB: Record<ClientKind, MachineKind> = { washer: '세탁기', dryer: '건조기' };

function isClientKind(value: string): value is ClientKind {
  return value === 'washer' || value === 'dryer';
}

/** DB 사유가 이미 report-rules.ts 의 MACHINE_KINDS 와 같은 집합인지 다시 한번 확인 */
function toDbKind(clientKind: ClientKind): MachineKind {
  const dbKind = CLIENT_KIND_TO_DB[clientKind];
  if (!isMachineKind(dbKind)) throw new Error('알 수 없는 기기 종류입니다.');
  return dbKind;
}

/** 23505 가 어느 제약에서 났는지 — 둘의 뜻이 전혀 다르다 */
function constraintOf(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: string; constraint?: string };
  if (e.code !== '23505') return null;
  return e.constraint ?? '';
}

type RouteParams = { params: Promise<{ kind: string }> };

/** F3 · F4 — 줄서기. 빈 기기가 있고 내 앞에 아무도 없으면 그 자리에서 배정된다. */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }
  // 05 P24 — 탈퇴를 신청하면 즉시 이용이 정지된다. 화면만 막으면 라우트를 직접
  // 부르는 길이 남는다(account-guard.ts 머리말 · 08 · 9번 「API 도 막는다」).
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  const { kind } = await params;
  if (!isClientKind(kind)) {
    return NextResponse.json({ ok: false, message: '알 수 없는 기기 종류예요.' }, { status: 400 });
  }
  const dbKind = toDbKind(kind);

  try {
    // 05 P3 · 08 · 4번(Issue #8) — 10분 안에 QR 인증이 없는 배정을 먼저 훑어
    // 푼다. 줄서기 때마다 여기서 지연평가하므로, 방치된 배정이 하루 치 cron
    // 백스톱(cleanup.ts)을 기다리지 않고 이 요청 안에서 곧바로 기기를 돌려준다
    // — 아래 drainQueue() 가 방금 풀린 기기를 바로 배정할 수 있게.
    // 실패해도 줄서기 자체는 막지 않는다(다음 cron 백스톱이 대신 훑는다).
    try {
      await expireOverdueAssignments();
    } catch (error) {
      console.error('배정 만료 스윕 실패(줄서기는 계속 진행)', error);
    }

    // ── 1걸음: 대기 중으로 줄을 세운다 (한 문장)
    //
    // 05 P7(이용 제한) · P10 · P20(그 종류에 쓸 기기가 하나도 없음)을 같은 문장에서
    // 본다. 따로 조회하면 왕복이 늘고, 조회와 INSERT 사이에 제한이 걸리는 틈도 생긴다.
    // 05 P1(같은 종류 두 줄)은 queue_one_line_per_kind UNIQUE 가 계속 지킨다.
    const gate = await sql<{
      queue_id: string | null;
      queued_at: string | null;
      restricted_days_left: number | null;
      kind_serviceable: boolean;
    }>`
      WITH me AS (
        SELECT ${userId}::uuid AS user_id, ${dbKind}::text AS machine_kind
      ),
      restriction AS (
        SELECT CASE WHEN r.restricted_until IS NULL OR r.restricted_until <= now() THEN NULL
                    ELSE CEIL(EXTRACT(EPOCH FROM (r.restricted_until - now())) / 86400)::int
               END AS days_left
          FROM usage_restrictions r
          JOIN me ON me.user_id = r.user_id
      ),
      serviceable AS (
        -- 05 P10 · P20 — 고장 · 점검중만 남은 종류에는 기다릴 대상이 없다.
        SELECT EXISTS (
          SELECT 1 FROM machines m JOIN me ON m.kind = me.machine_kind
           WHERE m.status IN ('사용가능', '사용중')
        ) AS ok
      ),
      inserted AS (
        INSERT INTO queue (user_id, machine_kind, status)
        SELECT me.user_id, me.machine_kind, '대기 중'
          FROM me
         WHERE NOT EXISTS (SELECT 1 FROM restriction WHERE days_left IS NOT NULL)
           AND (SELECT ok FROM serviceable)
        RETURNING queue_id, queued_at
      )
      SELECT (SELECT queue_id  FROM inserted) AS queue_id,
             (SELECT queued_at FROM inserted) AS queued_at,
             (SELECT days_left FROM restriction) AS restricted_days_left,
             (SELECT ok FROM serviceable) AS kind_serviceable
    `;

    const row = gate[0];
    const daysLeft = row?.restricted_days_left ?? null;
    if (daysLeft !== null) {
      return NextResponse.json(
        { ok: false, message: `이용 제한 중이에요 · ${daysLeft}일 남음`, reason: 'restricted', daysLeft },
        { status: 403 },
      );
    }
    if (!row?.kind_serviceable) {
      return NextResponse.json(
        { ok: false, message: '지금은 대기할 수 있는 기기가 없어요.', reason: 'no_machines' },
        { status: 409 },
      );
    }
    const queueId = row.queue_id;
    if (!queueId) {
      // 위의 두 분기가 전부 통과했는데 INSERT 가 없었다면 알 수 없는 상태다.
      throw new Error('줄을 세우지 못했습니다.');
    }

    // ── 2걸음: 배정 판정 (05 P2 · P3). 빈 기기가 있고 내 앞에 아무도 없을 때만
    //    내 줄이 올라온다. 별도 재조회를 하지 않고 이 결과에서 내 것을 찾는다.
    const mine = (await drainQueue()).find((a) => a.queue_id === queueId);

    if (mine) {
      return NextResponse.json(
        {
          ok: true,
          status: 'assigned',
          machineId: mine.machine_id,
          machineName: mine.machine_name,
          assignedAt: mine.assigned_at,
          assignDeadlineAt: mine.assign_deadline_at,
          queuedAt: row.queued_at,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'waiting',
        machineId: null,
        machineName: null,
        assignedAt: null,
        assignDeadlineAt: null,
        queuedAt: row.queued_at,
      },
      { status: 201 },
    );
  } catch (error) {
    // 23505 를 뭉뚱그리지 않는다 — 두 제약의 뜻이 전혀 다르다.
    const constraint = constraintOf(error);
    if (constraint !== null) {
      // 05 P1 — 같은 종류에 두 번 줄 설 수 없다.
      if (constraint !== 'queue_machine_once_idx') {
        return NextResponse.json(
          { ok: false, message: '이미 대기열에 참여 중이에요.', reason: 'already_queued' },
          { status: 409 },
        );
      }
      // 같은 기기에 두 줄 — 정상 경로에서는 나올 수 없는 값이다(drainQueue 의 잠금과
      // NOT EXISTS 가 막는다). 나왔다면 데이터가 어긋난 것이라 로그를 남긴다.
      console.error('배정 충돌: queue_machine_once_idx', userId, dbKind, error);
      return NextResponse.json(
        { ok: false, message: '방금 다른 분이 배정됐어요. 다시 시도해주세요.', reason: 'retry' },
        { status: 409 },
      );
    }
    console.error('줄서기 실패', userId, dbKind, error);
    return NextResponse.json(
      { ok: false, message: '줄서기에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}

/** F7 — 줄 빠지기. 배정 상태에서는 할 수 없다(05 P3). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }
  const blocked = withdrawPendingBlock(session);
  if (blocked) return blocked;

  const { kind } = await params;
  if (!isClientKind(kind)) {
    return NextResponse.json({ ok: false, message: '알 수 없는 기기 종류예요.' }, { status: 400 });
  }
  const dbKind = toDbKind(kind);

  try {
    const current = await sql<{ queue_id: string; status: string }>`
      SELECT queue_id, status FROM queue
       WHERE user_id = ${userId} AND machine_kind = ${dbKind}
       LIMIT 1
    `;
    const row = current[0];
    if (!row) {
      return NextResponse.json({ ok: false, message: '대기 중인 줄이 없어요.' }, { status: 404 });
    }
    if (row.status !== '대기 중') {
      return NextResponse.json(
        { ok: false, message: '배정 상태에서는 줄 빠지기를 할 수 없어요.', reason: 'assigned' },
        { status: 403 },
      );
    }

    // 조건부 DELETE — 확인과 삭제 사이에 배정이 끼어들었다면 0행이 되어 안전하다.
    const deleted = await sql<{ queue_id: string }>`
      DELETE FROM queue
       WHERE queue_id = ${row.queue_id} AND status = '대기 중'
      RETURNING queue_id
    `;
    if (deleted.length === 0) {
      return NextResponse.json(
        { ok: false, message: '방금 배정돼서 줄 빠지기를 할 수 없어요.', reason: 'assigned' },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('줄 빠지기 실패', userId, dbKind, error);
    return NextResponse.json(
      { ok: false, message: '줄 빠지기에 실패했어요. 잠시 뒤 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
