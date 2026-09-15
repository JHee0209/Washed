'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useUnreadCount } from '@/lib/use-unread-count';
import NotificationPrompt from '@/components/notification-prompt';
import { useRouter } from 'next/navigation';

// --- 전역 상수 (타이머 시간 등) ---
const READY_MS = 10 * 60 * 1000;
const RUN_MS_WASHER = 60 * 60 * 1000;
const RUN_MS_DRYER = 45 * 60 * 1000;
const GRACE_MS = 3 * 60 * 1000;
const runMsFor = (type: string) => (type === 'dryer' ? RUN_MS_DRYER : RUN_MS_WASHER);
const MY_USER_KEY = '원병찬·302호';

// 임시 기기 데이터
const initialMachines = [
  { id: 'w1', type: 'washer', name: '세탁기 1호기', status: 'inuse', remaining: 20 },
  { id: 'w2', type: 'washer', name: '세탁기 2호기', status: 'available', remaining: 0 },
  { id: 'w3', type: 'washer', name: '세탁기 3호기', status: 'inuse', remaining: 20 },
  { id: 'w4', type: 'washer', name: '세탁기 4호기', status: 'available', remaining: 0 },
  { id: 'w5', type: 'washer', name: '세탁기 5호기', status: 'inuse', remaining: 20 },
  { id: 'w6', type: 'washer', name: '세탁기 6호기', status: 'available', remaining: 0 },
  { id: 'w7', type: 'washer', name: '세탁기 7호기', status: 'inuse', remaining: 20 },
  { id: 'w8', type: 'washer', name: '세탁기 8호기', status: 'fault', remaining: 0 },
  { id: 'd1', type: 'dryer', name: '건조기 1호기', status: 'inuse', remaining: 15 },
  { id: 'd2', type: 'dryer', name: '건조기 2호기', status: 'inuse', remaining: 15 },
  { id: 'd3', type: 'dryer', name: '건조기 3호기', status: 'inuse', remaining: 15 },
  { id: 'd4', type: 'dryer', name: '건조기 4호기', status: 'inuse', remaining: 15 },
];

export default function HomePage() {
  const router = useRouter();

  // --- 상태 관리 ---
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [typeFilter, setTypeFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [warningId, setWarningId] = useState<string | null>(null);
  const [expiredOpen, setExpiredOpen] = useState(false);
  
  const [queue, setQueue] = useState<Record<string, any>>({});
  const [typeQueue, setTypeQueue] = useState<Record<string, any>>({});
  const [extraWaiters, setExtraWaiters] = useState({ washer: 2, dryer: 1 });
  const [rawMachines, setRawMachines] = useState(initialMachines);
  
  // 종의 점은 DB 가 센다 (F18 · 05 P14 — 보관 기간까지 서버가 건다).
  const unreadCount = useUnreadCount();
  const hasUnread = unreadCount > 0;

  // --- 알림(Toast) 함수 ---
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  // --- 실시간 타이머 및 엔진 시뮬레이션 ---
  useEffect(() => {
    const tick = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      setQueue((prevQ) => {
        const newQ = { ...prevQ };
        let changed = false;

        // 상태 체크 및 만료 처리
        Object.keys(newQ).forEach((id) => {
          const e = newQ[id];
          if (e.phase === 'ready' && currentTime >= e.readyDeadline) {
            delete newQ[id];
            changed = true;
            setExpiredOpen(true);
            showToast(`${e.name} 배정 시간 10분이 지나 경고가 1회 누적됐어요.`);
          } else if (e.phase === 'running' && currentTime >= e.runDeadline) {
            newQ[id] = { ...e, phase: 'grace', graceDeadline: currentTime + GRACE_MS };
            changed = true;
            showToast(`${e.name} 이용 시간이 끝났어요. 3분 안에 "다했어요"를 눌러주세요.`);
          } else if (e.phase === 'grace' && currentTime >= e.graceDeadline) {
            delete newQ[id];
            changed = true;
            showToast(`${e.name}에서 시간 내 "다했어요"를 누르지 않아 경고가 1회 누적됐어요.`);
            // 기기 상태 초기화
            setRawMachines((prev) => prev.map(m => m.id === id ? { ...m, status: 'available' } : m));
          }
        });
        return changed ? newQ : prevQ;
      });

      // 가짜 대기 인원 변동 시뮬레이션
      if (Math.random() < 0.05) {
        const type = Math.random() < 0.5 ? 'washer' : 'dryer';
        const delta = Math.random() < 0.5 ? -1 : 1;
        setExtraWaiters((s) => ({ ...s, [type]: Math.min(6, Math.max(0, s[type] + delta)) }));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // --- 핸들러 함수 ---
  const join = (id: string, name: string) => {
    const currentTime = Date.now();
    setQueue((prev) => ({ ...prev, [id]: { phase: 'ready', name, readyDeadline: currentTime + READY_MS } }));
    showToast(`${name}를 바로 이용할 수 있어요. 10분 안에 QR을 찍어주세요.`);
  };

  const autoJoin = (type: string, label: string) => {
    const currentTime = Date.now();
    const list = rawMachines.filter((r) => r.type === type);
    const free = list.filter((r) => r.status === 'available');
    
    if (free.length > 0) {
      join(free[0].id, free[0].name);
      return;
    }
    const busy = list.filter((r) => r.status === 'inuse');
    if (busy.length === 0) { showToast(`지금은 대기할 수 있는 ${label}가 없어요.`); return; }
    if (typeQueue[type]) { showToast(`이미 ${label} 대기열에 참여 중이에요.`); return; }
    
    const soonest = busy.reduce((a, b) => (a.remaining <= b.remaining ? a : b));
    const othersWaiting = Object.values(typeQueue).filter((t) => t.type === type).length;
    
    setTypeQueue((prev) => ({ ...prev, [type]: { type, turnAt: currentTime + Math.max(soonest.remaining, 1) * 60000, othersWaiting } }));
    showToast(`${label} 대기열에 참여했어요. 먼저 끝나는 기기로 자동 배정돼요.`);
  };

  const leaveType = (type: string, label: string) => {
    setTypeQueue((prev) => { const n = { ...prev }; delete n[type]; return n; });
    showToast(`${label} 대기열에서 나갔어요.`);
  };

  const leave = (id: string, name: string) => {
    setQueue((prev) => { const n = { ...prev }; delete n[id]; return n; });
    showToast(`${name} 대기열에서 나갔어요. 다시 신청하면 맨 뒤로 들어가요.`);
  };

  const start = (id: string) => {
    setScanningId(null);
    const m = rawMachines.find((r) => r.id === id);
    if (!m) return;
    setQueue((prev) => ({ ...prev, [id]: { ...prev[id], phase: 'running', runDeadline: Date.now() + runMsFor(m.type) } }));
    showToast(`${m.name} QR 인증 완료! 타이머가 시작됐어요.`);
  };

  const finish = (id: string, name: string) => {
    setQueue((prev) => { const n = { ...prev }; delete n[id]; return n; });
    showToast(`${name} 이용을 완료했어요. 다음 분이 이용할 수 있어요.`);
  };

  // --- 화면 렌더링용 연산 ---
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const effectiveStatus = (r: any) => queue[r.id] ? 'inuse' : r.status;
  
  const primaryBtn = { border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '10px', padding: '9px', fontSize: '12px', fontWeight: 700, boxShadow: '0px 6px 14px -6px rgba(47,99,184,.9)' };
  const leaveBtn = { border: 'none', cursor: 'pointer', color: '#E0554E', background: 'transparent', boxShadow: 'inset 0 0 0 1px #F0B6B2', borderRadius: '10px', padding: '8px', fontSize: '12px', fontWeight: 700 };
  const disabledBtn = { border: 'none', cursor: 'default', color: '#A8BCD9', background: '#EDF2FA', borderRadius: '10px', padding: '8px', fontSize: '12px', fontWeight: 700 };

  const filteredMachines = typeFilter === 'all' ? rawMachines : rawMachines.filter((r) => r.type === typeFilter);
  
  const machinesUI = filteredMachines.map((r) => {
    const status = effectiveStatus(r);
    const isInUse = status === 'inuse';
    const isFault = status === 'fault';
    
    let badgeFg = '#4A5F82', badgeDot = '#B9C9DF', badgeLabel = '사용가능';
    if (isFault) { badgeFg = '#E52222'; badgeDot = '#E52222'; badgeLabel = '고장'; }
    else if (isInUse) { badgeFg = '#3B76CC'; badgeDot = '#5B93E0'; badgeLabel = '사용중'; }

    const e = queue[r.id];
    let actionLabel = null, actionOnClick = () => {}, actionDisabled = false, actionStyle: any = leaveBtn;

    if (e && e.phase === 'waiting') {
      actionLabel = '줄 빠지기'; actionOnClick = () => leave(r.id, r.name);
    } else if (e) {
      actionLabel = '이용 중'; actionDisabled = true; actionStyle = disabledBtn;
    }

    let showProgress = false, progressPct = 0;
    if (e && e.phase === 'running') {
      const msLeft = Math.max(0, e.runDeadline - now);
      progressPct = Math.min(100, Math.max(4, 100 - (msLeft / runMsFor(r.type)) * 100));
      showProgress = true;
    } else if (e && e.phase === 'grace') {
      progressPct = 100; showProgress = true;
    }

    return { ...r, badgeFg, badgeDot, badgeLabel, iconInuse: isInUse, iconAvailable: !isInUse && !isFault, iconFault: isFault, showProgress, progress: `${progressPct}%`, actionLabel, actionOnClick, actionDisabled, actionStyle };
  });

  const washerMachines = machinesUI.filter((m) => m.type === 'washer');
  const dryerMachines = machinesUI.filter((m) => m.type === 'dryer');

  // 요약 영역
  const summarize = (type: 'washer'|'dryer', label: string, color: string) => {
    const list = rawMachines.filter((r) => r.type === type);
    const total = list.length;
    const available = list.filter((r) => effectiveStatus(r) === 'available').length;
    const inuse = total - available;
    const assignedId = list.map((r) => r.id).find((id) => queue[id]);
    const assigned = assignedId ? { ...list.find((r) => r.id === assignedId), ...queue[assignedId] } : null;
    const waitingType = typeQueue[type];
    const hasFreeSlot = list.length > 0;
    const waitingCount = available > 0 ? 0 : (extraWaiters[type] || 0) + (waitingType ? 1 : 0);

    let actionLabel, actionOnClick, actionDisabled = false, actionStyle, actionInfo;
    if (assigned) {
      actionLabel = null; actionOnClick = () => {}; actionStyle = primaryBtn; actionInfo = `${assigned.name} 이용 중`;
    } else if (waitingType) {
      actionLabel = null; actionOnClick = () => {}; actionStyle = disabledBtn; actionInfo = `현재 ${waitingCount}명 대기 중이에요`;
    } else if (!hasFreeSlot) {
      actionLabel = '잠시만요'; actionOnClick = () => {}; actionDisabled = true; actionStyle = disabledBtn; actionInfo = '곧 다시 신청할 수 있어요';
    } else {
      actionLabel = '줄서기'; actionOnClick = () => autoJoin(type, label); actionStyle = primaryBtn; actionInfo = available > 0 ? '바로 배정돼요' : `현재 ${waitingCount}명 대기 중이에요`;
    }

    return { label, total, available, inuse, availablePct: `${(available / total) * 100}%`, inusePct: `${(inuse / total) * 100}%`, availableColor: '#DCE6F3', inuseColor: color, actionLabel, actionOnClick, actionDisabled, actionStyle, actionInfo };
  };

  const typeSummaries = [ summarize('washer', '세탁기', '#5B93E0'), summarize('dryer', '건조기', '#F0913F') ];

  const myWaiting = Object.values(typeQueue).map((t) => ({
    isWasher: t.type === 'washer', isDryer: t.type === 'dryer', name: t.type === 'washer' ? '세탁기 대기열' : '건조기 대기열',
    waitLeft: fmt(Math.max(0, t.turnAt - now)),
    leave: () => leaveType(t.type, t.type === 'washer' ? '세탁기' : '건조기'),
  }));

  const myCurrent: any[] = [];
  rawMachines.forEach((r) => {
    const e = queue[r.id];
    if (!e) return;
    const icon = { isWasher: r.type === 'washer', isDryer: r.type === 'dryer' };
    if (e.phase === 'ready') {
      myCurrent.push({ ...icon, name: r.name, timeLeft: fmt(e.readyDeadline - now), timeColor: '#5B93E0', message: '10분이 지나면 순서가 넘어갑니다. 시간 내에 QR 인증해 주세요.', msgColor: '#8FAAD0', btnLabel: 'QR 인증', btnStyle: { ...primaryBtn, width: '100%' }, onClick: () => setWarningId(r.id) });
    } else if (e.phase === 'running') {
      myCurrent.push({ ...icon, name: r.name, timeLeft: `약 ${fmt(e.runDeadline - now)}`, timeColor: '#5B93E0', message: '이용 완료 후 "다했어요"를 눌러주세요.', msgColor: '#8FAAD0', btnLabel: '다했어요', btnStyle: { ...leaveBtn, width: '100%' }, onClick: () => finish(r.id, r.name) });
    } else if (e.phase === 'grace') {
      myCurrent.push({ ...icon, name: r.name, timeLeft: fmt(e.graceDeadline - now), timeColor: '#E0554E', message: '시간이 끝났어요! 지금 누르지 않으면 경고가 쌓여요.', msgColor: '#E0554E', btnLabel: '다했어요', btnStyle: { ...leaveBtn, width: '100%' }, onClick: () => finish(r.id, r.name) });
    }
  });

  const fullyIdle = myWaiting.length === 0 && myCurrent.length === 0;

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
        html { overflow: hidden; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
        a { color: #5B93E0; text-decoration: none; }
        a:hover { color: #3B76CC; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes qrScan { 0% { top: 8% } 100% { top: 88% } }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>

        {/*
          05 P26 — 로그인 뒤 홈 첫 진입에서 폰 알림 허용을 한 번만 묻는다.
          이미 물어봤거나 브라우저가 허용 · 거절을 기억하고 있으면 아무것도 그리지
          않으므로 기존 레이아웃에는 영향이 없다(자기 자리에 떠 있는 카드다).
        */}
        <NotificationPrompt />
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px', position: 'relative' }}>
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
          <Link href="/notifications" style={{ display: 'flex', width: '25px', height: '25px', borderRadius: '8px', position: 'absolute', right: '30px', top: '60px', background: `url(${hasUnread ? '/icons/bell-active.svg' : '/icons/bell.svg'}) center / cover no-repeat` }}></Link>
        </div>

        {/* 메인 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: '1 1 0', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overflowX: 'hidden' }}>
          <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '23px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3557', marginTop: '-5px' }}>안녕하세요, 병찬</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#8FAAD0' }}>오늘도 줄 서지 않고 편하게 세탁해요</p>
            </div>

            {/* 아무것도 안 할 때 */}
            {fullyIdle && (
              <div style={{ background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', height: '48px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#8FAAD0' }}>아무것도 사용하지 않고 있습니다</span>
              </div>
            )}

            {/* 대기 및 사용 중인 내역 */}
            {!fullyIdle && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
                {/* 내 대기 현황 */}
                <div style={{ background: '#fff', borderRadius: '20px', padding: '14px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, alignSelf: 'stretch' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#5B93E0' }}>내 대기 현황</span>
                  {myWaiting.length === 0 && <span style={{ fontSize: '12px', color: '#8FAAD0' }}>대기 중인 기기가 없어요</span>}
                  {myWaiting.map((mq, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        <img src={mq.isWasher ? "/icons/washer-inuse.svg" : "/icons/dryer-inuse.svg"} alt="" style={{ width: '30px', height: '30px', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mq.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#5B93E0' }}>약 {mq.waitLeft} 후 배정</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#8FAAD0', lineHeight: 1.4, marginTop: '9px', marginBottom: '8px' }}>이용 예정이 아니면 줄 빠지기를 눌러주세요.</span>
                      <button onClick={mq.leave} style={leaveBtn}>줄 빠지기</button>
                    </div>
                  ))}
                </div>

                {/* 현재 상태 */}
                <div style={{ background: '#fff', borderRadius: '20px', padding: '14px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, alignSelf: 'stretch' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: myCurrent.some(c => c.timeColor === '#E0554E') ? '#E0554E' : '#5B93E0' }}>현재 상태</span>
                  {myCurrent.map((cu, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={cu.isWasher ? "/icons/washer-inuse.svg" : "/icons/dryer-inuse.svg"} alt="" style={{ width: '30px', height: '30px', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cu.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: cu.timeColor }}>{cu.timeLeft} 남음</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: cu.msgColor, lineHeight: 1.4, marginTop: '9px', marginBottom: '8px' }}>{cu.message}</span>
                      <button onClick={cu.onClick} style={cu.btnStyle}>{cu.btnLabel}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 실시간 대기 현황 (그래프) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3557' }}>실시간 대기 현황</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#8FAAD0' }}>차례 10분 전, 이용 가능해질 때 알려드려요</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
              {typeSummaries.map((ts, idx) => (
                <div key={idx} style={{ background: '#fff', borderRadius: '18px', padding: '14px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{ts.label}</span>
                    <span style={{ fontSize: '11px', color: '#8FAAD0' }}>전체 {ts.total}대</span>
                  </div>
                  <div style={{ display: 'flex', height: '7px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ background: ts.inuseColor, width: ts.inusePct }}></div>
                    <div style={{ background: ts.availableColor, width: ts.availablePct }}></div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#8FAAD0', flexWrap: 'wrap' }}>
                    <span><span style={{ color: ts.inuseColor, fontWeight: 700 }}>{ts.inuse}</span> 사용중</span>
                    <span><span style={{ color: ts.availableColor, fontWeight: 700 }}>{ts.available}</span> 가능</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: '#5B93E0' }}>{ts.actionInfo}</span>
                    {ts.actionLabel && <button onClick={ts.actionOnClick} disabled={ts.actionDisabled} style={{ ...ts.actionStyle as any, width: '100%' }}>{ts.actionLabel}</button>}
                  </div>
                </div>
              ))}
            </div>

            {/* 기기 목록 필터 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>기기 목록</div>
                <div style={{ display: 'flex', gap: '4px', background: '#E4EDFA', borderRadius: '12px', padding: '3px' }}>
                  {[{ key: 'all', label: '전체' }, { key: 'washer', label: '세탁기' }, { key: 'dryer', label: '건조기' }].map((f) => (
                    <div key={f.key} onClick={() => setTypeFilter(f.key)} style={{ cursor: 'pointer', padding: '5px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap', background: typeFilter === f.key ? '#fff' : 'transparent', color: typeFilter === f.key ? '#1E3557' : '#8FAAD0' }}>{f.label}</div>
                  ))}
                </div>
              </div>

              {/* 세탁기 리스트 */}
              {washerMachines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#8FAAD0' }}>세탁기</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '8px' }}>
                    {washerMachines.map((m, idx) => (
                      <div key={idx} style={{ background: '#fff', borderRadius: '14px', padding: '10px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        {m.iconAvailable && <img src="/icons/washer-available.svg" alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />}
                        {m.iconInuse && <img src="/icons/washer-inuse.svg" alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />}
                        {m.iconFault && (
                          <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
                            <img src="/icons/washer-inuse.svg" alt="" style={{ width: '24px', height: '24px', filter: 'grayscale(1) opacity(.55)' }} />
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: '#E52222', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>!</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.badgeDot, flexShrink: 0 }}></div>
                            <span style={{ fontSize: '9.5px', fontWeight: 600, color: m.badgeFg }}>{m.badgeLabel}</span>
                          </div>
                        </div>
                        {m.showProgress && <div style={{ height: '4px', borderRadius: '2px', background: '#EDF2FA', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', inset: 0, width: m.progress, background: '#5B93E0', borderRadius: '2px' }}></div></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {washerMachines.length > 0 && dryerMachines.length > 0 && <div style={{ height: '1px', background: '#E3EBF7' }}></div>}

              {/* 건조기 리스트 */}
              {dryerMachines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#8FAAD0' }}>건조기</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '8px' }}>
                    {dryerMachines.map((m, idx) => (
                      <div key={idx} style={{ background: '#fff', borderRadius: '14px', padding: '10px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        {m.iconAvailable && <img src="/icons/dryer-available.svg" alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />}
                        {m.iconInuse && <img src="/icons/dryer-inuse.svg" alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.badgeDot, flexShrink: 0 }}></div>
                            <span style={{ fontSize: '9.5px', fontWeight: 600, color: m.badgeFg }}>{m.badgeLabel}</span>
                          </div>
                        </div>
                        {m.showProgress && <div style={{ height: '4px', borderRadius: '2px', background: '#EDF2FA', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', inset: 0, width: m.progress, background: '#5B93E0', borderRadius: '2px' }}></div></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 하단 탭 바 */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '8px 0', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(112,115,124,.12)', height: '60px' }}>
          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center' }}>
            <Link href="/home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px', background: 'rgba(0,102,255,.08)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0066FF' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#0066FF' }}>홈</span>
            </Link>
            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>기록</span>
            </Link>
            <Link href="/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>설정</span>
            </Link>
          </div>
        </div>

        {/* 모달 1: QR 안내 경고창 */}
        {warningId && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(20,42,84,.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '300px', background: '#fff', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,42,84,.55)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>QR 인증 안내</span>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>QR을 찍으면 바로 타이머가 시작돼요.<br/>세탁물을 넣은 뒤 기기에 붙은 QR을 찍어주세요.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setWarningId(null)} style={{ border: 'none', cursor: 'pointer', color: '#1E3557', background: 'transparent', boxShadow: 'inset 0 0 0 1px #E3EBF7', borderRadius: '12px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>취소</button>
                <button onClick={() => { setScanningId(warningId); setWarningId(null); }} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 700 }}>확인</button>
              </div>
            </div>
          </div>
        )}

        {/* 모달 2: QR 스캐너 */}
        {scanningId && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(13,28,58,.74)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '300px', background: '#17233C', borderRadius: '20px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0px 20px 44px -12px rgba(8,20,46,.75)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#EEF4FD' }}>QR 스캔</span>
                <div onClick={() => setScanningId(null)} style={{ cursor: 'pointer', color: 'rgba(224,235,250,.62)', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</div>
              </div>
              <div style={{ position: 'relative', aspectRatio: 1, borderRadius: '18px', overflow: 'hidden', background: '#0D1728' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 10px, transparent 10px 20px)' }}></div>
                <div style={{ position: 'absolute', left: '12%', top: '12%', width: '20px', height: '20px', borderLeft: '3px solid #5B93E0', borderTop: '3px solid #5B93E0', borderRadius: '4px 0 0 0' }}></div>
                <div style={{ position: 'absolute', right: '12%', top: '12%', width: '20px', height: '20px', borderRight: '3px solid #5B93E0', borderTop: '3px solid #5B93E0', borderRadius: '0 4px 0 0' }}></div>
                <div style={{ position: 'absolute', left: '12%', bottom: '12%', width: '20px', height: '20px', borderLeft: '3px solid #5B93E0', borderBottom: '3px solid #5B93E0', borderRadius: '0 0 0 4px' }}></div>
                <div style={{ position: 'absolute', right: '12%', bottom: '12%', width: '20px', height: '20px', borderRight: '3px solid #5B93E0', borderBottom: '3px solid #5B93E0', borderRadius: '0 0 4px 0' }}></div>
                <div style={{ position: 'absolute', left: '12%', right: '12%', height: '2px', background: '#5B93E0', boxShadow: '0 0 12px rgba(91,147,224,.85)', animation: 'qrScan 1.8s ease-in-out infinite alternate' }}></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#EEF4FD', textAlign: 'center' }}>{(rawMachines.find(r => r.id === scanningId) || {}).name}</span>
                <span style={{ fontSize: '11px', color: 'rgba(224,235,250,.62)', lineHeight: 1.5, textAlign: 'center' }}>QR 코드를 사각형 안에 맞춰주세요.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setScanningId(null)} style={{ flex: 1, border: 'none', cursor: 'pointer', color: '#EEF4FD', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(224,235,250,.26)', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 700 }}>취소</button>
                <button onClick={() => start(scanningId)} style={{ flex: 1, border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: 700 }}>인식 완료</button>
              </div>
            </div>
          </div>
        )}

        {/* 모달 3: 인증 시간 초과 */}
        {expiredOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(20,42,84,.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '300px', background: '#fff', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,42,84,.55)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>인증 시간 초과</span>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>인증 시간이 초과되어 다음 대기자에게 순서가 넘어갑니다. 이용을 원하실 경우 다시 줄서기해주세요.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setExpiredOpen(false)} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 700 }}>확인</button>
              </div>
            </div>
          </div>
        )}

        {/* 하단 토스트 알림 */}
        {toast.visible && (
          <div style={{ position: 'absolute', left: '50%', bottom: '64px', transform: 'translateX(-50%)', zIndex: 110, background: '#17233C', color: '#EEF4FD', borderRadius: '14px', padding: '10px 16px', fontSize: '12.5px', fontWeight: 600, boxShadow: '0px 10px 24px -8px rgba(20,42,84,.85)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '88%' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#5BD39A', flexShrink: 0 }}></div>
            <span>{toast.message}</span>
          </div>
        )}

      </div>
    </>
  );
}