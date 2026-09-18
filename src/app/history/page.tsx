import Link from 'next/link';

import { requireMe, myHistory, myWarnings } from '@/lib/queries';
import NotificationBell from '@/components/notification-bell';

export const dynamic = 'force-dynamic';

const SEOUL_TZ = 'Asia/Seoul';
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const monthDayFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TZ,
  month: 'long',
  day: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function seoulDayKey(d: Date) {
  return dayKeyFmt.format(d);
}

// 자정 경계는 KST 기준이라 서버가 UTC 로 돌아도 "오늘 · 어제" 가 어긋나지 않는다.
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const today = seoulDayKey(new Date());
  const yesterday = seoulDayKey(new Date(Date.now() - 86_400_000));
  const key = seoulDayKey(d);
  if (key === today) return '오늘';
  if (key === yesterday) return '어제';
  return monthDayFmt.format(d);
}

function timeLabel(iso: string) {
  return timeFmt.format(new Date(iso));
}

type TimelineItem = {
  key: string;
  at: string;
  name: string;
  iconSrc: string | null;
  time: string;
  duration?: string;
  hasWarning: boolean;
  warningText: string;
  statusBg: string;
  statusDot: string;
  statusFg: string;
  statusLabel: '완료' | '경고';
};

export default async function HistoryPage() {
  const me = await requireMe();
  const [history, { warnings, restriction }] = await Promise.all([
    myHistory(me.userId),
    myWarnings(me.userId),
  ]);

  // --- 타임라인: usage_history 전부 + '배정 후 미인증'(세션 자체가 없는 건) 병합 ---
  // '수거 미완료' · '신고 확인' 사유는 이미 해당 usage_history 행의 result='경고'로
  // 반영돼 있으므로 여기서 다시 넣지 않는다 (중복 방지).
  const usageItems: TimelineItem[] = history.map((h) => ({
    key: h.history_id,
    at: h.started_at,
    name: h.machine_name ?? '(삭제된 기기)',
    iconSrc: h.machine_kind === '건조기' ? '/icons/dryer-history.svg' : '/icons/washer-history.svg',
    time: timeLabel(h.started_at),
    duration: `${h.duration_minutes}분`,
    hasWarning: h.result === '경고',
    warningText: '',
    statusBg: h.result === '경고' ? 'rgba(255,146,0,.12)' : 'rgba(0,191,64,.1)',
    statusDot: h.result === '경고' ? '#FF9200' : '#00BF40',
    statusFg: h.result === '경고' ? '#9C5800' : '#006E25',
    statusLabel: h.result === '경고' ? '경고' : '완료',
  }));

  const unusedItems: TimelineItem[] = warnings
    .filter((w) => w.reason === '배정 후 미인증')
    .map((w) => ({
      key: w.warning_id,
      at: w.issued_at,
      name: '배정 후 미인증',
      iconSrc: null,
      time: timeLabel(w.issued_at),
      duration: undefined,
      hasWarning: true,
      warningText: w.reason,
      statusBg: 'rgba(255,146,0,.12)',
      statusDot: '#FF9200',
      statusFg: '#9C5800',
      statusLabel: '경고',
    }));

  const allItems = [...usageItems, ...unusedItems].sort(
    (a, b) => +new Date(b.at) - +new Date(a.at),
  );

  const groupsMap = new Map<string, TimelineItem[]>();
  for (const item of allItems) {
    const label = dateLabel(item.at);
    const bucket = groupsMap.get(label);
    if (bucket) bucket.push(item);
    else groupsMap.set(label, [item]);
  }
  const decoratedGroups = [...groupsMap.entries()].map(([date, items]) => ({ date, items }));

  // --- 통계 ---
  const useCount = history.length;
  const totalMinutes = history.reduce((sum, h) => sum + h.duration_minutes, 0);
  const useHours = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}시간` : `${totalMinutes}분`;

  // 07-screens.md — 헤더 건수는 기간 무관 현재값(P7), 사유 목록만 30일(P21)
  const warningCount = restriction?.warning_count ?? 0;
  const hasWarnings = warningCount > 0;
  const suspendLabel = restriction?.is_restricted
    ? `이용 제한 중 · ${restriction.days_left}일 남음`
    : '누적 3회가 되면 3일동안 줄서기를 할 수 없어요';

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
        html { overflow: hidden; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
        a { color: #2F63B8; text-decoration: none; }
        a:hover { color: #1F4E9C; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .card { background: #fff; border-radius: 16px; border: 1px solid #E6EDF7; }
        .chip { width: 38px; height: 38px; border-radius: 12px; background: #F2F7FD; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>

        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px', position: 'relative' }}>
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
          <NotificationBell />
        </div>

        {/* 메인 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '18px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px', animation: 'riseIn .5s ease-out both' }}>

            {/* 타이틀 */}
            <div>
              <h1 style={{ margin: 0, fontSize: '25px', fontWeight: 800, letterSpacing: '-0.7px' }}>기록</h1>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#8FAAD0' }}>최근 30일간의 세탁 · 건조 기록이에요</p>
            </div>

            {/* 상단 통계 카드 */}
            <div className="card" style={{ display: 'flex', padding: '16px 0' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#2F63B8', lineHeight: 1 }}>{useCount}</div>
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#8FAAD0' }}>이용 횟수</div>
              </div>
              <div style={{ width: '1px', background: '#EDF2F9' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#2F63B8', lineHeight: 1 }}>{useHours}</div>
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#8FAAD0' }}>총 사용 시간</div>
              </div>
              <div style={{ width: '1px', background: '#EDF2F9' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#D98324', lineHeight: 1 }}>{warningCount}</div>
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#8FAAD0' }}>받은 경고</div>
              </div>
            </div>

            {/* 경고 박스 */}
            {hasWarnings && (
              <div style={{ borderRadius: '16px', padding: '15px 16px', background: '#FEF6EC', border: '1px solid #F7E0C4', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F0913F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>!</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#8A5220' }}>받은 경고 {warningCount}건</div>
                    <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#A97740', lineHeight: 1.5 }}>{suspendLabel}</div>
                  </div>
                </div>
                {warnings.map((w) => (
                  <div key={w.warning_id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 12px', borderRadius: '12px', background: '#fff', border: '1px solid #F3E2CC' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8A5220' }}>{dateLabel(w.issued_at)} {timeLabel(w.issued_at)}</span>
                    <span style={{ fontSize: '11.5px', color: '#A97740' }}>{w.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 타임라인 히스토리 내역 */}
            {decoratedGroups.map((grp) => (
              <div key={grp.date} style={{ position: 'relative', paddingLeft: '20px' }}>
                {/* 좌측 세로 선과 파란 점 */}
                <div style={{ position: 'absolute', left: '3px', top: '7px', bottom: '6px', width: '2px', background: '#E3EBF7', borderRadius: '1px' }}></div>
                <div style={{ position: 'absolute', left: 0, top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#5B93E0', boxShadow: '0 0 0 3px #E8F1FD' }}></div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#5A7CA8', marginBottom: '9px' }}>{grp.date}</div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  {grp.items.map((h, hIdx) => (
                    <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: hIdx === grp.items.length - 1 ? 'none' : '1px solid #EDF2F9' }}>
                      <div className="chip">
                        {h.iconSrc ? (
                          <img src={h.iconSrc} alt={h.name} style={{ width: '24px', height: '24px' }} />
                        ) : (
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F0913F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>!</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{h.name}</span>
                        <span style={{ fontSize: '11.5px', color: '#8FAAD0', marginTop: '3px' }}>
                          {h.time}{h.duration && ` · ${h.duration} 사용`}
                        </span>
                        {h.hasWarning && h.warningText && (
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8A5220', marginTop: '5px' }}>{h.warningText}</span>
                        )}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 9px', borderRadius: '999px', background: h.statusBg, flexShrink: 0 }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: h.statusDot }}></div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: h.statusFg }}>{h.statusLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* 하단 탭 바 */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '8px 0', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(112,115,124,.12)', height: '60px' }}>
          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center' }}>
            <Link href="/home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>홈</span>
            </Link>
            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px', background: 'rgba(0,102,255,.08)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0066FF' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#0066FF' }}>기록</span>
            </Link>
            <Link href="/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>설정</span>
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
