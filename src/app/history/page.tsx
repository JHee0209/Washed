'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUnreadCount } from '@/lib/use-unread-count';

const MY_USER_KEY = '원병찬·302호';

// 임시 기록 데이터 (나중에 DB에서 가져올 데이터)
//
// duration · warning 은 **없을 수 있다** — 배정만 받고 쓰지 않으면(05 P3) 사용 시간이
// 없고, 경고 없이 끝난 건에는 사유가 없다. 타입을 적어 두지 않으면 추론이 항목마다
// 갈려(union) `it.duration` 을 읽을 수 없다.
type HistoryItem = {
  name: string;
  time: string;
  iconSrc: string;
  duration?: string;
  warning?: string;
};

const baseGroups: { date: string; items: HistoryItem[] }[] = [
  { date: '오늘', items: [
    { name: '세탁기 2호기', time: '09:12', duration: '52분', iconSrc: '/icons/washer-history.svg' },
  ]},
  { date: '어제', items: [
    { name: '건조기 1호기', time: '21:04', duration: '38분', iconSrc: '/icons/dryer-history.svg', warning: '"다했어요" 버튼을 누르지 않아 경고를 받았어요' },
    { name: '세탁기 4호기', time: '20:10', duration: '49분', iconSrc: '/icons/washer-history.svg' },
  ]},
  { date: '9월 6일', items: [
    // 배정만 받고 쓰지 않았으니 사용 시간이 없다
    { name: '건조기 2호기', time: '18:33', iconSrc: '/icons/dryer-history.svg', warning: '배정 후 미이용' },
  ]},
];

export default function HistoryPage() {
  const [now, setNow] = useState<number>(0);
  // 종의 점은 DB 가 센다 (F18).
  const unreadCount = useUnreadCount();
  const hasUnread = unreadCount > 0;
  const [warnEntry, setWarnEntry] = useState({ count: 0, suspendedUntil: null as number | null });

  // 주기적으로 시간 업데이트 및 로컬 스토리지 확인
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 2000);

    try {
      const store = JSON.parse(localStorage.getItem('washed_warnings') || '{}');
      if (store[MY_USER_KEY]) {
        setWarnEntry(store[MY_USER_KEY]);
      }
    } catch (e) {}

    return () => clearInterval(tick);
  }, []);

  // --- 데이터 집계 로직 ---
  const warnings: any[] = [];
  baseGroups.forEach((g) => g.items.forEach((it) => {
    if (it.warning) warnings.push({ ...it, date: g.date, warningText: it.warning });
  }));

  const warningCount = warnings.length;
  const hasWarnings = warningCount > 0;
  
  // 이용 제한 여부 계산
  const suspended = !!(warnEntry.suspendedUntil && now < warnEntry.suspendedUntil);
  const suspendLabel = suspended && warnEntry.suspendedUntil
    ? `이용 제한 중 · ${Math.max(1, Math.ceil((warnEntry.suspendedUntil - now) / 86400000))}일 남음`
    : '누적 3회가 되면 3일동안 줄서기를 할 수 없어요';

  // UI용 데코레이션(상태 컬러, 라벨) 데이터 생성
  const decoratedGroups = baseGroups.map((g) => ({
    ...g,
    items: g.items.map((it) => ({
      ...it,
      hasWarning: !!it.warning,
      warningText: it.warning || '',
      showDuration: !!it.duration,
      statusBg: it.warning ? 'rgba(255,146,0,.12)' : 'rgba(0,191,64,.1)',
      statusDot: it.warning ? '#FF9200' : '#00BF40',
      statusFg: it.warning ? '#9C5800' : '#006E25',
      statusLabel: it.warning ? '경고' : '완료',
    })),
  }));

  // 이용 횟수 및 총 사용 시간 계산
  const allItems = baseGroups.reduce((acc: any[], g) => acc.concat(g.items), []);
  const usedItems = allItems.filter((it) => it.duration);
  const totalMinutes = usedItems.reduce((sum, it) => sum + (parseInt(it.duration, 10) || 0), 0);
  const useCount = usedItems.length;
  const useHours = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}시간` : `${totalMinutes}분`;

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
          <Link href="/notifications" style={{ boxSizing: 'border-box', width: '25px', height: '25px', borderRadius: '8px', position: 'absolute', right: '30px', top: '60px', background: `url(${hasUnread ? '/icons/bell-active.svg' : '/icons/bell.svg'}) center / cover no-repeat` }}></Link>
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
                {warnings.map((w, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 12px', borderRadius: '12px', background: '#fff', border: '1px solid #F3E2CC' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8A5220' }}>{w.date} {w.time} · {w.name}</span>
                    <span style={{ fontSize: '11.5px', color: '#A97740' }}>{w.warningText}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 타임라인 히스토리 내역 */}
            {decoratedGroups.map((grp, idx) => (
              <div key={idx} style={{ position: 'relative', paddingLeft: '20px' }}>
                {/* 좌측 세로 선과 파란 점 */}
                <div style={{ position: 'absolute', left: '3px', top: '7px', bottom: '6px', width: '2px', background: '#E3EBF7', borderRadius: '1px' }}></div>
                <div style={{ position: 'absolute', left: 0, top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#5B93E0', boxShadow: '0 0 0 3px #E8F1FD' }}></div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#5A7CA8', marginBottom: '9px' }}>{grp.date}</div>
                
                <div className="card" style={{ overflow: 'hidden' }}>
                  {grp.items.map((h, hIdx) => (
                    <div key={hIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: hIdx === grp.items.length - 1 ? 'none' : '1px solid #EDF2F9' }}>
                      <div className="chip"><img src={h.iconSrc} alt={h.name} style={{ width: '24px', height: '24px' }} /></div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{h.name}</span>
                        <span style={{ fontSize: '11.5px', color: '#8FAAD0', marginTop: '3px' }}>
                          {h.time}{h.showDuration && ` · ${h.duration} 사용`}
                        </span>
                        {h.hasWarning && (
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