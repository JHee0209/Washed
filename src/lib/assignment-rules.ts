// 배정 규칙 — **누가 어느 기기를 받는가**를 정하는 한 곳 (05 P2 · P3 · 08 · 3번).
//
// 08 · 3번: 「배정은 서버가 정하고 클라이언트는 결과만 받는다」 · 「"가장 먼저 끝나는
// 기기에 배정"(05 P2) 규칙도 서버로 옮긴다」. 그 규칙의 **판정부**가 여기 있고,
// 실제로 행을 잠그고 쓰는 SQL 은 src/lib/assignment.ts 에 있다.
//
// 두 곳으로 가른 이유는 report-rules.ts · retention.ts 와 같다 — 이 파일은 DB 도
// `server-only` 도 import 하지 않아서, node --test 가 DB 없이 그대로 돌린다
// (src/lib/assignment-rules.test.ts). 짝짓기 규칙이 SQL 안에만 있으면 DB 를 띄우기
// 전까지 아무것도 확인할 수 없다.
//
// **SQL 과 이 파일은 같은 규칙을 두 번 적은 것이 아니다.** assignment.ts 의
// row_number() 조인이 이 함수와 **같은 순서 · 같은 짝짓기**를 하도록 맞춰 두었고,
// 그쪽 주석이 이 파일을 가리킨다. 규칙을 바꾸면 두 곳을 함께 본다.

/**
 * 05 P3 — 「배정 후 **10분** 안에 QR 인증으로 시작해야 한다」.
 *
 * 이 숫자를 쓰는 곳은 셋이고 전부 이 상수를 본다:
 *   · assignment.ts 의 `interval '10 minutes'` (서버가 assign_deadline_at 을 찍는다)
 *   · 이 파일의 assignDeadlineFrom()
 *   · 화면의 카운트다운은 **이 값을 쓰지 않는다** — 서버가 준 마감 시각만 본다 (08 · 4번)
 */
export const ASSIGN_WINDOW_MINUTES = 10;

/**
 * 배정 마감 시각 (06 「줄서기」의 「배정 마감 시각(배정 시각 + 10분)」 · 05 P3).
 *
 * **기산점은 언제나 「기기가 사용가능이 된 서버 시각」이다** (05 상태값 마지막 줄 ·
 * 08 · 4번). 앞사람의 수거 3분은 여기 들어가지 않는다 — 수거대기 동안 기기는
 * `사용중` 이라 배정 대상 자체가 아니고, 그래서 다음 사람의 assigned_at 은 아직
 * NULL 이다. 10분은 기기가 실제로 비는 순간부터 센다.
 */
export function assignDeadlineFrom(assignedAt: Date): Date {
  return new Date(assignedAt.getTime() + ASSIGN_WINDOW_MINUTES * 60 * 1000);
}

/**
 * 05 P4 — QR 인증 성공 뒤 사용 시간. 세탁기 60분 · 건조기 45분이며, 실제 코스
 * 시간과 어긋날 수 있어 화면은 "약 N분"으로 적는다(04 F8의 [?]).
 *
 * 지금까지는 `src/app/home/page.tsx`의 `RUN_MS_WASHER`/`RUN_MS_DRYER`로 화면에만
 * 있던 값이다 — Issue #6 에서 QR 인증이 서버로 옮겨 오면서 `machines.ends_at`을
 * 서버가 찍어야 하므로, 그 기준값을 여기(서버 쪽 단일 기준)로 옮긴다.
 */
export const RUN_MINUTES_BY_KIND: Record<string, number> = { 세탁기: 60, 건조기: 45 };

/** 짝짓기에 들어가는 빈 기기 한 대 */
export type FreeMachine = {
  machineId: string;
  /** '세탁기' | '건조기' — 05 P1 의 두 줄을 가르는 값이다 */
  kind: string;
  name: string;
};

/** 짝짓기에 들어가는 대기 중인 줄 하나 */
export type WaitingEntry = {
  queueId: string;
  machineKind: string;
  /** 06 「줄 선 시각」 — 다시 서면 그 시각으로 맨 뒤다 (05 P8) */
  queuedAt: Date;
};

/** 짝지어진 결과 한 쌍 */
export type AssignmentPair = {
  queueId: string;
  machineId: string;
  machineName: string;
  kind: string;
};

/**
 * 05 P2 — 「줄 선 순서대로, 같은 종류 중 **가장 먼저 끝나는 기기**에 자동 배정한다.
 * 특정 호기를 지정할 수 없다.」
 *
 * 종류별로 갈라, k 번째 대기자에게 k 번째 기기를 준다. 호기를 고를 수 없으므로
 * **같은 종류의 빈 기기는 서로 구별되지 않고**, 그래서 짝짓기는 순위 조인 하나면
 * 충분하다. 대기자가 기기보다 많으면 앞에서부터 잘리고 나머지는 대기 중으로 남는다.
 *
 * ── 「가장 먼저 끝나는 기기」는 아래 정렬이 지키는 것이 아니다
 * 여기 들어오는 기기는 이미 전부 비어 있다(05 상태값 — `사용가능` 이면 종료 예정
 * 시각이 없다). **먼저 끝난 기기가 먼저 `사용가능` 이 되어 먼저 이 목록에 들어오는
 * 것**으로 P2 가 지켜진다. `name` 정렬은 그 뒤에 남는 동률을 가르는 값일 뿐이라,
 * 같은 입력이면 늘 같은 짝이 나온다(서버가 두 번 불려도 결과가 흔들리지 않는다).
 *
 * @param free    지금 배정할 수 있는 기기들 (고장 · 점검중 · 사용중은 이미 빠져 있다 · 05 P10 · P20)
 * @param waiting 대기 중인 줄들
 */
export function pairWaitersWithMachines(
  free: readonly FreeMachine[],
  waiting: readonly WaitingEntry[],
): AssignmentPair[] {
  const freeByKind = new Map<string, FreeMachine[]>();
  for (const machine of free) {
    const list = freeByKind.get(machine.kind);
    if (list) list.push(machine);
    else freeByKind.set(machine.kind, [machine]);
  }
  for (const list of freeByKind.values()) {
    list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  const waitingByKind = new Map<string, WaitingEntry[]>();
  for (const entry of waiting) {
    const list = waitingByKind.get(entry.machineKind);
    if (list) list.push(entry);
    else waitingByKind.set(entry.machineKind, [entry]);
  }
  for (const list of waitingByKind.values()) {
    // 05 P8 — 줄 선 시각이 순서다. 같은 시각이면 queue_id 로 가른다(SQL 과 같다).
    list.sort(
      (a, b) =>
        a.queuedAt.getTime() - b.queuedAt.getTime() ||
        (a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0),
    );
  }

  const pairs: AssignmentPair[] = [];
  for (const [kind, waiters] of waitingByKind) {
    const machines = freeByKind.get(kind) ?? [];
    const n = Math.min(machines.length, waiters.length);
    for (let i = 0; i < n; i += 1) {
      pairs.push({
        queueId: waiters[i].queueId,
        machineId: machines[i].machineId,
        machineName: machines[i].name,
        kind,
      });
    }
  }
  return pairs;
}
