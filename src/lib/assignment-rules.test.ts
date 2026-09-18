// src/lib/assignment-rules.ts 의 배정 짝짓기를 확인한다 (05 P2 · P3).
//
// 실행: npm test
//
// retention.test.ts · report-rules.test.ts 와 같은 방식이다 — Node 내장 테스트
// 러너(node:test)와 타입 스트리핑만 쓰고, `@/` 별칭 대신 상대 경로로 불러온다
// (별칭은 번들러가 푸는 것이라 node 가 직접 돌릴 때는 없다).
//
// **여기서 확인하는 것은 DB 없이 판정되는 「누가 어느 기기를 받는가」뿐이다.**
// 행 잠금 · 동시 요청 · queue_machine_once_idx 는 DB 가 있어야 확인되므로 이 파일에
// 없다 — src/lib/assignment.ts 머리말과 Issue #5 의 수동 확인 절차를 따른다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSIGN_WINDOW_MINUTES,
  assignDeadlineFrom,
  pairWaitersWithMachines,
  type FreeMachine,
  type WaitingEntry,
} from './assignment-rules.ts';

function machine(machineId: string, kind: string, name: string): FreeMachine {
  return { machineId, kind, name };
}

/** `minute` 분에 줄을 선 사람 — 숫자가 작을수록 앞이다 */
function waiter(queueId: string, kind: string, minute: number): WaitingEntry {
  return { queueId, machineKind: kind, queuedAt: new Date(Date.UTC(2026, 8, 16, 10, minute)) };
}

describe('05 P3 — 배정 10분', () => {
  it('배정 마감은 배정 시각 + 10분이다', () => {
    const assignedAt = new Date('2026-09-16T10:00:00.000Z');
    assert.equal(ASSIGN_WINDOW_MINUTES, 10);
    assert.equal(assignDeadlineFrom(assignedAt).toISOString(), '2026-09-16T10:10:00.000Z');
  });

  it('기산점이 늦어지면 마감도 그만큼 늦어진다 — 앞사람의 수거 3분은 들어가지 않는다', () => {
    // 앞사람이 10:00 에 끝나 3분 동안 수거대기였다면, 기기가 실제로 사용가능이 되는
    // 것은 10:03 이고 다음 사람의 10분은 그때부터다 (05 상태값 · 08 · 4번).
    const machineFreeAt = new Date('2026-09-16T10:03:00.000Z');
    assert.equal(assignDeadlineFrom(machineFreeAt).toISOString(), '2026-09-16T10:13:00.000Z');
  });
});

describe('05 P2 — 줄 선 순서대로 배정', () => {
  it('빈 기기보다 대기자가 많으면 앞에서부터 잘린다', () => {
    const pairs = pairWaitersWithMachines(
      [machine('m1', '세탁기', '세탁기 1호기'), machine('m2', '세탁기', '세탁기 2호기')],
      [waiter('q1', '세탁기', 0), waiter('q2', '세탁기', 1), waiter('q3', '세탁기', 2)],
    );

    assert.equal(pairs.length, 2);
    assert.deepEqual(
      pairs.map((p) => p.queueId),
      ['q1', 'q2'],
    );
    // 셋째는 짝이 없다 — 대기 중으로 남는다
    assert.ok(!pairs.some((p) => p.queueId === 'q3'));
  });

  it('늦게 선 사람이 먼저 선 사람을 앞지르지 않는다', () => {
    // 입력 순서를 일부러 뒤집어 둔다 — 정렬이 없으면 q2 가 먼저 배정된다.
    const pairs = pairWaitersWithMachines(
      [machine('m1', '세탁기', '세탁기 1호기')],
      [waiter('q2', '세탁기', 5), waiter('q1', '세탁기', 1)],
    );

    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].queueId, 'q1');
  });

  it('줄 선 시각이 같으면 queue_id 로 갈라 항상 같은 결과가 나온다', () => {
    const tie: WaitingEntry[] = [waiter('q-b', '세탁기', 3), waiter('q-a', '세탁기', 3)];
    const once = pairWaitersWithMachines([machine('m1', '세탁기', '세탁기 1호기')], tie);
    const twice = pairWaitersWithMachines([machine('m1', '세탁기', '세탁기 1호기')], [...tie].reverse());

    assert.equal(once[0].queueId, 'q-a');
    assert.deepEqual(once, twice);
  });

  it('대기자가 빈 기기보다 적으면 남는 기기는 그대로 둔다', () => {
    const pairs = pairWaitersWithMachines(
      [machine('m1', '세탁기', '세탁기 1호기'), machine('m2', '세탁기', '세탁기 2호기')],
      [waiter('q1', '세탁기', 0)],
    );
    assert.equal(pairs.length, 1);
  });

  it('대기자가 없으면 아무것도 배정하지 않는다', () => {
    assert.deepEqual(pairWaitersWithMachines([machine('m1', '세탁기', '세탁기 1호기')], []), []);
  });

  it('빈 기기가 없으면 아무것도 배정하지 않는다', () => {
    assert.deepEqual(pairWaitersWithMachines([], [waiter('q1', '세탁기', 0)]), []);
  });
});

describe('05 P1 · P2 — 종류가 섞이지 않는다', () => {
  it('세탁기 대기자가 빈 건조기를 가져가지 않는다', () => {
    const pairs = pairWaitersWithMachines(
      [machine('d1', '건조기', '건조기 1호기')],
      [waiter('q1', '세탁기', 0)],
    );
    assert.deepEqual(pairs, []);
  });

  it('두 종류가 섞여 있어도 각자 자기 종류에서만 짝을 짓는다', () => {
    const pairs = pairWaitersWithMachines(
      [machine('d1', '건조기', '건조기 1호기'), machine('w1', '세탁기', '세탁기 1호기')],
      [waiter('qw', '세탁기', 0), waiter('qd', '건조기', 9)],
    );

    const byQueue = new Map(pairs.map((p) => [p.queueId, p.machineId]));
    assert.equal(byQueue.get('qw'), 'w1');
    assert.equal(byQueue.get('qd'), 'd1');
  });
});

describe('중복 배정 방지 — 같은 기기가 두 명에게 가지 않는다', () => {
  it('한 대를 여러 대기자가 기다려도 machine_id 는 한 번만 나간다', () => {
    const pairs = pairWaitersWithMachines(
      [machine('m1', '세탁기', '세탁기 1호기')],
      [waiter('q1', '세탁기', 0), waiter('q2', '세탁기', 1), waiter('q3', '세탁기', 2)],
    );

    const machineIds = pairs.map((p) => p.machineId);
    assert.equal(new Set(machineIds).size, machineIds.length);
    assert.deepEqual(machineIds, ['m1']);
  });

  it('여러 기기 · 여러 대기자에서도 기기와 줄이 각각 한 번씩만 쓰인다', () => {
    const pairs = pairWaitersWithMachines(
      [
        machine('m1', '세탁기', '세탁기 1호기'),
        machine('m2', '세탁기', '세탁기 2호기'),
        machine('m3', '세탁기', '세탁기 3호기'),
      ],
      [waiter('q1', '세탁기', 0), waiter('q2', '세탁기', 1), waiter('q3', '세탁기', 2)],
    );

    assert.equal(new Set(pairs.map((p) => p.machineId)).size, 3);
    assert.equal(new Set(pairs.map((p) => p.queueId)).size, 3);
  });
});
