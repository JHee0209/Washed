// F3 · F4 · F7 — 줄서기 · 줄 빠지기 (05 P1 · P2 · P3 · P7 · P8 · P20).
//
// db/schema.sql 의 queue · machines · usage_restrictions 는 이미 06/05 문서 그대로
// 있다 — 여기서는 그 표에 쓰는 경로만 새로 연다. src/lib/db.ts 의 neon 드라이버는
// 여러 쿼리에 걸친 명시적 BEGIN/COMMIT 을 지원하지 않으므로(admin-actions.ts 의
// addNotice, api/reports/route.ts 가 같은 이유로 CTE 한 문장을 쓴다), 배정 판정도
// 한 문장으로 만든다. 동시 요청 경합은 setReportStatus 가 쓰는 것과 같은 관용구
// (조건부 UPDATE 가 0행이면 대기 분기로 떨어진다)로 막는다 — 별도 행 잠금이 없어도
// 안전하다.

import 'server-only';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
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

type RouteParams = { params: Promise<{ kind: string }> };

/** F3 · F4 — 줄서기. 빈 기기가 있으면 그 자리에서 배정한다. */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  const { kind } = await params;
  if (!isClientKind(kind)) {
    return NextResponse.json({ ok: false, message: '알 수 없는 기기 종류예요.' }, { status: 400 });
  }
  const dbKind = toDbKind(kind);

  try {
    // 05 P7 — 이용 제한 중에는 줄서기가 눌리지 않는다.
    const restriction = await sql<{ days_left: number | null }>`
      SELECT CASE WHEN restricted_until IS NULL OR restricted_until <= now() THEN NULL
                  ELSE CEIL(EXTRACT(EPOCH FROM (restricted_until - now())) / 86400)::int
             END AS days_left
        FROM usage_restrictions
       WHERE user_id = ${userId}
       LIMIT 1
    `;
    const daysLeft = restriction[0]?.days_left ?? null;
    if (daysLeft !== null) {
      return NextResponse.json(
        { ok: false, message: `이용 제한 중이에요 · ${daysLeft}일 남음`, reason: 'restricted', daysLeft },
        { status: 403 },
      );
    }

    // 05 P2 · P20 — 사용가능(점검중 · 고장 · 사용중이 아닌) 기기가 있으면 그 자리에서
    // 배정하고, 없으면 대기 중으로 줄을 세운다. 두 경우 모두 한 문장으로 처리한다.
    const rows = await sql<{
      queue_id: string;
      status: string;
      machine_id: string | null;
      assigned_at: string | null;
      assign_deadline_at: string | null;
      queued_at: string;
      machine_name: string | null;
    }>`
      WITH picked AS (
        UPDATE machines
           SET status = '사용중'
         WHERE machine_id = (
           SELECT machine_id FROM machines
            WHERE kind = ${dbKind} AND status = '사용가능'
            ORDER BY name
            LIMIT 1
         ) AND status = '사용가능'
        RETURNING machine_id, name
      ),
      inserted AS (
        -- INSERT ... SELECT (VALUES 가 아니다)라 Postgres 가 매개변수 타입을 스스로
        -- 추론하지 못한다 — 캐스트가 없으면 "user_id 는 uuid인데 값은 text" 에러가 난다.
        INSERT INTO queue (user_id, machine_kind, machine_id, status, assigned_at, assign_deadline_at)
        SELECT ${userId}::uuid, ${dbKind}::text, picked.machine_id, '배정', now(), now() + interval '10 minutes'
          FROM picked
        UNION ALL
        SELECT ${userId}::uuid, ${dbKind}::text, NULL::uuid, '대기 중', NULL::timestamptz, NULL::timestamptz
         WHERE NOT EXISTS (SELECT 1 FROM picked)
        RETURNING queue_id, status, machine_id, assigned_at, assign_deadline_at, queued_at
      )
      SELECT i.*, p.name AS machine_name
        FROM inserted i
        LEFT JOIN picked p ON p.machine_id = i.machine_id
    `;

    const row = rows[0];
    return NextResponse.json(
      {
        ok: true,
        status: row.status === '배정' ? 'assigned' : 'waiting',
        machineId: row.machine_id,
        machineName: row.machine_name,
        assignDeadlineAt: row.assign_deadline_at,
        queuedAt: row.queued_at,
      },
      { status: 201 },
    );
  } catch (error) {
    // 05 P1 — 같은 종류에 두 번 줄 설 수 없다 (queue_one_line_per_kind UNIQUE 제약).
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return NextResponse.json(
        { ok: false, message: '이미 대기열에 참여 중이에요.', reason: 'already_queued' },
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
