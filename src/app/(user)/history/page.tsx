// 이용 기록 (F13 · 05 P7 · P14 · P21).
//
// **서버가 하는 일은 조회와 판정뿐이다** (Issue #13). 화면 문구를 네 언어로 그리려면
// useT() 가 필요하고 그것은 클라이언트에서만 도므로, 그리는 쪽은 history-client.tsx
// 로 갈랐다 — /home · /settings 와 같은 page.tsx + *-client.tsx 짝이다.
//
// **「오늘 · 어제」 판정을 클라이언트로 옮기지 않았다.** KST 자정 경계를 넘나드는
// 판정이라 서버 시각으로 해야 한다(CLAUDE.md — 클라이언트 Date.now() 를 정책 판정
// 기준으로 쓰지 않는다). 여기서 판정해 `{ kind: 'today' | 'yesterday' | 'date' }` 로
// 내려보내고, 화면은 그 결과에 문구만 입힌다.
//
// DB 값(기기 이름 · result · reason)은 **번역하지 않고 그대로** 넘긴다 — 화면이
// 그릴 때만 db-labels 로 라벨을 고른다 (13번 「동적 데이터와 고정 UI 구분」).

import { requireMe, myHistory, myWarnings } from '@/lib/queries';
import HistoryClient, {
  type DateLabel,
  type HistoryGroup,
  type HistoryItem,
  type HistoryWarning,
} from './history-client';

export const dynamic = 'force-dynamic';

const SEOUL_TZ = 'Asia/Seoul';
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function seoulDayKey(d: Date) {
  return dayKeyFmt.format(d);
}

// 자정 경계는 KST 기준이라 서버가 UTC 로 돌아도 "오늘 · 어제" 가 어긋나지 않는다.
function dateLabel(iso: string): DateLabel {
  const today = seoulDayKey(new Date());
  const yesterday = seoulDayKey(new Date(Date.now() - 86_400_000));
  const key = seoulDayKey(new Date(iso));
  if (key === today) return { kind: 'today' };
  if (key === yesterday) return { kind: 'yesterday' };
  return { kind: 'date', iso };
}

/** 같은 날끼리 묶을 때 쓰는 값 — 「오늘」도 날짜가 바뀌면 다른 묶음이 된다 */
function groupKey(label: DateLabel): string {
  return label.kind === 'date' ? seoulDayKey(new Date(label.iso)) : label.kind;
}

export default async function HistoryPage() {
  const me = await requireMe();
  const [history, { warnings, restriction }] = await Promise.all([
    myHistory(me.userId),
    myWarnings(me.userId),
  ]);

  // --- 타임라인: usage_history 전부 + '배정 후 미인증'(세션 자체가 없는 건) 병합 ---
  // '수거 미완료' · '신고 확인' 사유는 이미 해당 usage_history 행의 result='경고'로
  // 반영돼 있으므로 여기서 다시 넣지 않는다 (중복 방지).
  const usageItems: HistoryItem[] = history.map((h) => ({
    key: h.history_id,
    at: h.started_at,
    machineName: h.machine_name ?? null,
    machineKind: h.machine_kind ?? null,
    durationMinutes: h.duration_minutes,
    result: h.result === '경고' ? '경고' : '완료',
  }));

  const unusedItems: HistoryItem[] = warnings
    .filter((w) => w.reason === '배정 후 미인증')
    .map((w) => ({
      key: w.warning_id,
      at: w.issued_at,
      machineName: null,
      machineKind: null,
      result: '경고',
      // 이 값이 있으면 화면은 그것을 줄의 제목으로 삼는다(같은 사유를 두 번 적지 않는다)
      warningReason: w.reason,
    }));

  const allItems = [...usageItems, ...unusedItems].sort(
    (a, b) => +new Date(b.at) - +new Date(a.at),
  );

  const groupsMap = new Map<string, HistoryGroup>();
  for (const item of allItems) {
    const label = dateLabel(item.at);
    const key = groupKey(label);
    const bucket = groupsMap.get(key);
    if (bucket) bucket.items.push(item);
    else groupsMap.set(key, { key, label, items: [item] });
  }
  const groups = [...groupsMap.values()];

  const warningRows: HistoryWarning[] = warnings.map((w) => ({
    warningId: w.warning_id,
    issuedAt: w.issued_at,
    reason: w.reason,
    label: dateLabel(w.issued_at),
  }));

  // --- 통계 ---
  // 07-screens.md — 헤더 건수는 기간 무관 현재값(P7), 사유 목록만 30일(P21)
  return (
    <HistoryClient
      groups={groups}
      warnings={warningRows}
      useCount={history.length}
      totalMinutes={history.reduce((sum, h) => sum + h.duration_minutes, 0)}
      warningCount={restriction?.warning_count ?? 0}
      restrictedDaysLeft={restriction?.is_restricted ? restriction.days_left : null}
    />
  );
}
