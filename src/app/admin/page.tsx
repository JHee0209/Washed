// F23~F29 관리자 콘솔 — docs/design/관리자.dc.html
//
// 탭 일곱 개를 전부 옮겼다.
//   1 실시간 기기 현황   2 실시간 대기열 현황   3 신고 내역   4 이용 내역
//   5 경고 누적 사용자   6 공지사항            7 사용자 목록
//
// 프로토타입이 localStorage 에서 읽던 값을 전부 DB 에서 읽는다 (08 · 2번).
// 2026-09-15 디자인 갱신분(white-space: nowrap · 가로 스크롤)도 그대로 반영했다 —
// 다국어로 바꿨을 때 표가 두 줄로 접히던 자리다.

import Link from 'next/link';'use client';

import { useState, useEffect } from 'react';

// --- 전역 유틸 함수 ---
const BAN_DAYS = 3;

const parseReportDate = (str: string) => {
  const [md, hm] = str.split(' ');
  const [mo, da] = md.split('/').map(Number);
  const [hh, mi] = hm.split(':').map(Number);
  const d = new Date(2026, mo - 1, da, hh, mi);
  if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
  return d;
};

const dayLabel = (date: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d0 = new Date(date); d0.setHours(0, 0, 0, 0);
  const days = Math.round(((today as any) - (d0 as any)) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (days < 28) return `${weeks}주일 전`;
  const months = Math.floor(days / 30);
  return months <= 1 ? '한달 전' : `${months}개월 전`;
};

const parseHistoryDate = (str: string) => {
  const [md] = str.split(' ');
  const [mo, da] = md.split('/').map(Number);
  const d = new Date(2026, mo - 1, da);
  if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
  return d;
};

const historyMonthKey = (str: string) => {
  const d = parseHistoryDate(str);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const [now, setNow] = useState(Date.now());
  
  // 관리자 상태 관리
  const [faults, setFaults] = useState<Record<string, boolean>>({});
  const [reportsStatus, setReportsStatus] = useState<Record<string, string>>({});
  const [extraMachines, setExtraMachines] = useState<any[]>([]);
  const [forcedAvailable, setForcedAvailable] = useState<Record<string, boolean>>({});
  const [removedIds, setRemovedIds] = useState<Record<string, boolean>>({});
  
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineType, setNewMachineType] = useState('washer');
  
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [notices, setNotices] = useState<any[]>([
    { title: '9월 정기 점검 안내', body: '여자 기숙사 세탁실은 9/11(금) 오전 9시~11시 점검으로 이용이 제한됩니다.', date: '2026.09.09' },
  ]);

  const [historyType, setHistoryType] = useState('전체');
  const [historyMachine, setHistoryMachine] = useState('전체');
  const [historyMonth, setHistoryMonth] = useState('전체');
  
  const [warnMonth, setWarnMonth] = useState('');
  const [warnMonthMenuOpen, setWarnMonthMenuOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState<Record<string, boolean>>({});

  const [noticeMonth, setNoticeMonth] = useState('전체');
  
  const [userSearch, setUserSearch] = useState('');
  const [userRoomFilter, setUserRoomFilter] = useState('전체');
  const [reportFilter, setReportFilter] = useState('전체');

  // 모달 제어 상태
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmRemoveName, setConfirmRemoveName] = useState('');
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState<any | null>(null);
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);

  // 실시간 동기화 타이머
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    try {
      const saved = JSON.parse(localStorage.getItem('washed_notices') || 'null');
      if (saved && saved.length) setNotices(saved);
      else localStorage.setItem('washed_notices', JSON.stringify(notices));
    } catch (e) {}
    return () => clearInterval(tick);
  }, []);

  const pushWarnLog = (key: string, reason: string) => {
    try {
      const log = JSON.parse(localStorage.getItem('washed_warnlog') || '[]');
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      log.unshift({
        id: `w${d.getTime()}`, key, reason,
        date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      });
      localStorage.setItem('washed_warnlog', JSON.stringify(log));
    } catch (e) {}
  };

  const popWarnLog = (key: string) => {
    try {
      const log = JSON.parse(localStorage.getItem('washed_warnlog') || '[]');
      const idx = log.findIndex((w: any) => w.key === key);
      if (idx >= 0) log.splice(idx, 1);
      localStorage.setItem('washed_warnlog', JSON.stringify(log));
    } catch (e) {}
  };

  const saveNotices = (list: any[]) => {
    try { localStorage.setItem('washed_notices', JSON.stringify(list)); } catch (e) {}
  };

  // --- 점검 모드 ---
  let maintenanceOn = false;
  try { maintenanceOn = localStorage.getItem('washed_maintenance') === '1'; } catch (e) {}
  const toggleMaintenance = () => {
    try { localStorage.setItem('washed_maintenance', maintenanceOn ? '0' : '1'); } catch (e) {}
    setNow(Date.now());
  };

  const tabs = [
    { key: 'dashboard', label: '실시간 기기 현황' },
    { key: 'queue', label: '실시간 대기열 현황' },
    { key: 'reports', label: '신고 내역' },
    { key: 'history', label: '이용 내역' },
    { key: 'warnings', label: '경고 누적 사용자' },
    { key: 'notice', label: '공지사항' },
    { key: 'users', label: '사용자 목록' },
  ];

  // --- 기기 데이터 세팅 ---
  const baseRaw = [
    { id: 'w1', type: 'washer', name: '세탁기 1호기', status: 'inuse', remaining: 8 },
    { id: 'w2', type: 'washer', name: '세탁기 2호기', status: 'inuse', remaining: 18 },
    { id: 'w3', type: 'washer', name: '세탁기 3호기', status: 'inuse', remaining: 22 },
    { id: 'w4', type: 'washer', name: '세탁기 4호기', status: 'inuse', remaining: 5 },
    { id: 'w5', type: 'washer', name: '세탁기 5호기', status: 'inuse', remaining: 27 },
    { id: 'w6', type: 'washer', name: '세탁기 6호기', status: 'inuse', remaining: 12 },
    { id: 'w7', type: 'washer', name: '세탁기 7호기', status: 'inuse', remaining: 40 },
    { id: 'w8', type: 'washer', name: '세탁기 8호기', status: 'inuse', remaining: 30 },
    { id: 'd1', type: 'dryer', name: '건조기 1호기', status: 'available', remaining: 0 },
    { id: 'd2', type: 'dryer', name: '건조기 2호기', status: 'available', remaining: 0 },
    { id: 'd3', type: 'dryer', name: '건조기 3호기', status: 'available', remaining: 0 },
    { id: 'd4', type: 'dryer', name: '건조기 4호기', status: 'available', remaining: 0 },
  ];

  let liveOverrides: Record<string, any> = {};
  try { liveOverrides = JSON.parse(localStorage.getItem('washed_machines') || '{}'); } catch (e) {}
  baseRaw.forEach((r) => {
    const o = liveOverrides[r.id];
    if (o) { r.status = o.status; r.remaining = o.remaining; }
  });

  let raw = baseRaw.filter((r) => !removedIds[r.id]);
  extraMachines.filter((x) => !removedIds[x.id]).forEach((x) => {
    const idx = raw.findIndex((r) => r.id === x.insertAfter);
    if (idx === -1) raw.push(x);
    else raw.splice(idx + 1, 0, x);
  });

  const machines = raw.map((r) => {
    const faulted = faults[r.id] !== undefined ? !!faults[r.id] : r.status === 'fault';
    const status = faulted ? 'fault' : (forcedAvailable && forcedAvailable[r.id] ? 'available' : (r.status === 'fault' ? 'available' : r.status));
    let statusLabel, statusColor, dot;
    if (status === 'fault') { statusLabel = '고장'; statusColor = '#E52222'; dot = '#FF4242'; }
    else if (status === 'inuse') { statusLabel = '사용중'; statusColor = '#2F63B8'; dot = '#2F63B8'; }
    else { statusLabel = '사용가능'; statusColor = '#96D16F'; dot = '#96D16F'; }

    return {
      name: r.name,
      statusLabel, statusColor, dot,
      remainingLabel: status === 'inuse' && Number.isFinite(r.remaining) ? `${r.remaining}분` : '-',
      faultBtnLabel: faulted ? '고장 해제' : '고장 처리',
      faultBtnStyle: faulted
        ? { border: 'none', cursor: 'pointer', color: '#171719', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }
        : { border: 'none', cursor: 'pointer', color: '#E52222', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(255,66,66,.32)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },
      toggleFault: () => {
        const next = !faulted;
        setFaults((st) => ({ ...st, [r.id]: next }));
        try {
          const store = JSON.parse(localStorage.getItem('washed_admin_faults') || '{}');
          store[r.id] = next;
          localStorage.setItem('washed_admin_faults', JSON.stringify(store));
        } catch (e) {}
      },
      showForceReset: status === 'inuse',
      hideForceReset: status !== 'inuse',
      forceReset: () => {
        setFaults((st) => ({ ...st, [r.id]: false }));
        setForcedAvailable((st) => ({ ...st, [r.id]: true }));
        try {
          const store = JSON.parse(localStorage.getItem('washed_admin_faults') || '{}');
          store[r.id] = false;
          localStorage.setItem('washed_admin_faults', JSON.stringify(store));
        } catch (e) {}
      },
      remove: () => { setConfirmRemoveId(r.id); setConfirmRemoveName(r.name); },
    };
  });

  const washerTotal = raw.filter((r) => r.type === 'washer').length;
  const dryerTotal = raw.filter((r) => r.type === 'dryer').length;
  const summaryCards = [
    { label: '세탁기 사용중', value: `${raw.filter((r) => r.type === 'washer' && r.status === 'inuse' && !(faults[r.id] !== undefined ? faults[r.id] : r.status === 'fault')).length}/${washerTotal}`, color: '#2F63B8' },
    { label: '건조기 사용중', value: `${raw.filter((r) => r.type === 'dryer' && r.status === 'inuse' && !(faults[r.id] !== undefined ? faults[r.id] : r.status === 'fault')).length}/${dryerTotal}`, color: '#FF4955' },
    { label: '고장 기기', value: `${raw.filter((r) => (faults[r.id] !== undefined ? !!faults[r.id] : r.status === 'fault')).length}대`, color: '#E52222' },
  ];

  // --- 대기열 현황 ---
  let liveQueue: Record<string, any> = {};
  try { liveQueue = JSON.parse(localStorage.getItem('washed_typequeue') || '{}'); } catch (e) {}
  const fmtWait = (ms: number) => {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(sec / 60), r = sec % 60;
    return `${m}분 ${r}초`;
  };
  const typeQueues = [
    { key: 'washer', label: '세탁기', mockCount: 1, mockTotal: 8 },
    { key: 'dryer', label: '건조기', mockCount: 5, mockTotal: 4 },
  ].map((t) => {
    const q = liveQueue[t.key];
    const count = q ? q.count : t.mockCount;
    const total = (q && q.total) || t.mockTotal;
    if (!count) return { label: t.label, hasWaiting: false, noWaiting: true, count: 0, rows: [] };

    const loadPctNum = Math.min(100, Math.round((count / (total * 1.5)) * 100));
    const loadLabel = loadPctNum >= 70 ? '혼잡' : loadPctNum >= 35 ? '보통' : '여유';
    const barColor = loadPctNum >= 70 ? '#E52222' : loadPctNum >= 35 ? '#D98324' : '#34B37E';
    const badgeBg = loadPctNum >= 70 ? 'rgba(229,34,34,.1)' : loadPctNum >= 35 ? 'rgba(217,131,36,.12)' : 'rgba(52,179,126,.12)';
    const badgeColor = loadPctNum >= 70 ? '#E52222' : loadPctNum >= 35 ? '#9C5800' : '#188A5E';
    const badgeLabel = `${loadLabel} · ${count}명`;

    const firstWaitMin = Math.max(1, Math.round(((q && q.waitLeftMs) || 0) / 60000));
    const avgWaitMin = Math.max(1, Math.round((firstWaitMin * count) / Math.max(count, 1)) + Math.round(count * 1.2));
    const rows = Array.from({ length: Math.min(count, 3) }, (_, i) => ({
      pos: i + 1,
      text: (q && q.mine && i === count - 1) ? '병찬 · 302호 (앱 사용자)' : (i === 0 ? '다음 차례' : `${i + 1}번째 대기`),
      eta: `약 ${firstWaitMin + i * 4}분 후`,
      rowBg: i === 0 ? 'rgba(47,99,184,.06)' : '#F7F7F8',
      badgeBg: i === 0 ? '#2F63B8' : '#DADCE0',
      badgeFg: i === 0 ? '#fff' : '#5A5C63',
    }));

    return {
      label: t.label, hasWaiting: true, noWaiting: false, count,
      loadPct: `${loadPctNum}%`, loadLabel, barColor, badgeBg, badgeColor, badgeLabel,
      waitLabel: q ? fmtWait(q.waitLeftMs) : `${firstWaitMin}분 0초`,
      avgWaitLabel: `${avgWaitMin}분`,
      rows, hasMore: count > 3, moreCount: count - 3,
    };
  });

  // --- 신고 내역 ---
  let liveReports: any[] = [];
  try { liveReports = JSON.parse(localStorage.getItem('washed_reports') || '[]'); } catch (e) {}
  const reportDefsAll = [
    ...liveReports,
    { id: 'r1', reason: '기기가 고장났어요', datetime: '09/09 14:20', reporter: '병찬 · 302호', resolved: false },
    { id: 'r2', reason: '순서를 지키지 않았어요', datetime: '09/08 21:03', reporter: '정주희 · 210호', resolved: false },
    { id: 'r3', reason: '세탁물이 있어요', datetime: '09/06 18:40', reporter: '서수영 · 115호', resolved: true },
    { id: 'r4', reason: '기타', datetime: '09/05 10:15', reporter: '조성원 · 306호', resolved: false },
    { id: 'r5', reason: '기기가 고장났어요', datetime: '09/07 16:45', reporter: '이태연 · 412호', status: '처리중' },
  ];
  const reportCutoff = new Date();
  reportCutoff.setMonth(reportCutoff.getMonth() - 3);
  const reportDefs = reportDefsAll.filter((r) => parseReportDate(r.datetime) >= reportCutoff);

  const persistLiveStatus = (id: string, status: string) => {
    try {
      const list = JSON.parse(localStorage.getItem('washed_reports') || '[]');
      const idx = list.findIndex((x: any) => x.id === id);
      if (idx !== -1) { list[idx].status = status; localStorage.setItem('washed_reports', JSON.stringify(list)); }
    } catch (e) {}
  };

  const reportList = reportDefs.map((r) => {
    const override = reportsStatus[r.id];
    const status = override || r.status || (r.resolved ? '처리완료' : '접수됨');
    const rejected = status === '반려';
    const resolved = status === '처리완료';
    const inProgress = status === '처리중';
    const machineOrEtc = r.machine || r.etc || '';
    return {
      reason: r.reason, datetime: r.datetime, reporter: r.reporter, detail: machineOrEtc,
      hasDetail: !!machineOrEtc,
      isFault: r.reason === '기기가 고장났어요',
      isOrder: r.reason === '순서를 지키지 않았어요',
      isLaundry: r.reason === '세탁물이 있어요',
      isEtc: !['기기가 고장났어요', '순서를 지키지 않았어요', '세탁물이 있어요'].includes(r.reason),
      statusLabel: status,
      statusBg: resolved ? 'rgba(0,191,64,.1)' : inProgress ? 'rgba(255,146,0,.12)' : rejected ? 'rgba(229,34,34,.1)' : 'rgba(47,99,184,.1)',
      statusFg: resolved ? '#006E25' : inProgress ? '#9C5800' : rejected ? '#E52222' : '#2F63B8',
      statusDot: resolved ? '#00BF40' : inProgress ? '#FF9200' : rejected ? '#E52222' : '#2F63B8',
      advance: () => {
        if (resolved || rejected) return;
        const next = inProgress ? '처리완료' : '처리중';
        setReportsStatus((st) => ({ ...st, [r.id]: next }));
        persistLiveStatus(r.id, next);
      },
      showReject: !resolved && !rejected,
      reject: () => {
        setReportsStatus((st) => ({ ...st, [r.id]: '반려' }));
        persistLiveStatus(r.id, '반려');
      },
      statusCursor: (resolved || rejected) ? 'default' : 'pointer',
      _label: dayLabel(parseReportDate(r.datetime)),
    };
  });

  const reportFilters = ['전체', '접수됨', '처리중', '처리완료', '반려'].map((label) => {
    const on = reportFilter === label;
    const base = 'display:flex;align-items:center;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;';
    return {
      label,
      style: base + (on ? 'background:#2F63B8;color:#fff' : 'background:#fff;color:#2F63B8;box-shadow:inset 0 0 0 1px rgba(47,99,184,.28)'),
      onClick: () => setReportFilter(label),
    };
  });

  const unsortedReports = reportFilter === '전체' ? reportList : reportList.filter((r) => r.statusLabel === reportFilter);
  const filteredReports = [...unsortedReports].sort((a, b) => parseReportDate(b.datetime).getTime() - parseReportDate(a.datetime).getTime());
  const reportGroupOrder: string[] = [];
  filteredReports.forEach((r) => { if (!reportGroupOrder.includes(r._label)) reportGroupOrder.push(r._label); });
  const reportGroups = reportGroupOrder.map((label) => ({
    label, items: filteredReports.filter((r) => r._label === label),
  }));

  // --- 경고 누적 사용자 ---
  const warningDefs = [
    { name: '이태연', school: '을지대', studentId: '20224120', room: '412호', count: 3, month: '2026.09', bannedSince: new Date('2026-09-09T10:00:00'), seedReasons: ['다했어요 버튼 미클릭', '배정 후 10분 내 미시작', '세탁물 미수거 30분 초과'] },
    { name: '이서연', school: '을지대', studentId: '20221080', room: '108호', count: 1, month: '2026.09', bannedSince: null, seedReasons: ['배정 후 10분 내 미시작'] },
    { name: '조성원', school: '을지대', studentId: '20220630', room: '306호', count: 2, month: '2026.08', bannedSince: null, seedReasons: ['다했어요 버튼 미클릭', '순서를 지키지 않음 (신고 확인)'] },
    { name: '정주희', school: '을지대', studentId: '20230210', room: '210호', count: 3, month: '2026.07', bannedSince: null, seedReasons: ['세탁물 미수거 30분 초과', '배정 후 10분 내 미시작', '다했어요 버튼 미클릭'] },
  ];
  const warnMonths: string[] = [];
  const nowD = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
    warnMonths.push(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  warnMonths.sort().reverse();
  const selectedWarnMonth = warnMonths.includes(warnMonth) ? warnMonth : warnMonths[0];
  const monthLabel = (m: string) => `${m.split('.')[0]}년 ${Number(m.split('.')[1])}월`;
  const warnMonthOptions = warnMonths.map((m) => {
    const on = selectedWarnMonth === m;
    return {
      label: monthLabel(m),
      bg: on ? 'rgba(47,99,184,.08)' : 'transparent',
      color: on ? '#2F63B8' : '#37383C',
      weight: on ? '700' : '500',
      onClick: () => { setWarnMonth(m); setWarnMonthMenuOpen(false); },
    };
  });

  let warnLogAll: any[] = [];
  try { warnLogAll = JSON.parse(localStorage.getItem('washed_warnlog') || '[]'); } catch (e) {}
  const warnLogCutoff = new Date();
  warnLogCutoff.setMonth(warnLogCutoff.getMonth() - 3);
  warnLogAll = warnLogAll.filter((l: any) => new Date(String(l.date).replace(/\./g, '-')) >= warnLogCutoff);

  const warningUsers = warningDefs.filter((w) => w.month === selectedWarnMonth).map((w) => {
    const color = w.count >= 3 ? '#E52222' : '#9C5800';
    let banInfo = null;
    if (w.count >= 3 && w.bannedSince) {
      const daysLeft = BAN_DAYS - Math.floor((Date.now() - w.bannedSince.getTime()) / 86400000);
      if (daysLeft > 0) banInfo = `${daysLeft}일 뒤 사용 가능`;
    }
    const key = `${w.name}·${w.room}`;
    const liveReasons = warnLogAll.filter((l: any) => l.key === key).map((l: any) => ({ text: l.reason, when: `${l.date} ${l.time}` }));
    const reasons = liveReasons.length > 0 ? liveReasons : (w.seedReasons || []).slice(0, w.count).map((text) => ({ text, when: '' }));

    const LIMIT = 3;
    const on = w.count >= 3 ? '#E52222' : (w.count === 2 ? '#D98324' : '#5A7CA8');
    const off = 'rgba(112,115,124,.16)';
    const steps = [0, 1, 2].map((i) => ({ bg: i < w.count ? on : off }));
    const rowBg = w.count >= 3 ? 'rgba(229,34,34,.035)' : 'transparent';
    const gaugeLabel = w.count + ' / ' + LIMIT + ' · ' +
      (banInfo ? banInfo.replace(' 사용 가능', ' 남음') : Math.max(LIMIT - w.count, 0) + '회 남음');

    const recent = reasons[0];
    const recentLine = recent ? ('최근 ' + (recent.when || '') + ' · ' + recent.text) : '';
    const rest = reasons.slice(1);

    const expanded = (warnOpen || {})[key] === true;
    const moreLabel = expanded ? '접기 ⌃' : '외 ' + rest.length + '건 ⌄';
    const toggleMore = () => setWarnOpen((st) => ({ ...st, [key]: !expanded }));

    return { ...w, color, banInfo, showBanInfo: !!banInfo, reasons, hasReasons: reasons.length > 0, steps, rowBg, gaugeLabel, recentLine, restReasons: rest, hasMore: rest.length > 0, expanded, moreLabel, toggleMore };
  });

  // --- 공지사항 ---
  const noticeCutoff = new Date();
  noticeCutoff.setMonth(noticeCutoff.getMonth() - 3);
  const liveNotices = notices.filter((n) => new Date(n.date.replace(/\./g, '-')) >= noticeCutoff);

  const noticeMonths: string[] = [];
  const nowN = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(nowN.getFullYear(), nowN.getMonth() - i, 1);
    noticeMonths.push(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  liveNotices.forEach((n) => { const m = n.date.slice(0, 7); if (!noticeMonths.includes(m)) noticeMonths.push(m); });
  noticeMonths.sort().reverse();
  const noticeMonthOptions = [{ value: '전체', label: '전체' }, ...noticeMonths.map((m) => ({ value: m, label: `${m.split('.')[0]}년 ${Number(m.split('.')[1])}월` }))].map((o) => ({
    ...o, selected: noticeMonth === o.value,
  }));
  const filteredNotices = noticeMonth === '전체' ? liveNotices : liveNotices.filter((n) => n.date.slice(0, 7) === noticeMonth);

  // --- 사용자 목록 ---
  const userDefs = [
    { name: '원병찬', school: '을지대', studentId: '20231234', room: '302호', baseWarn: 0 },
    { name: '정주희', school: '을지대', studentId: '20230210', room: '210호', baseWarn: 0 },
    { name: '이태연', school: '을지대', studentId: '20224120', room: '412호', baseWarn: 2 },
    { name: '이서연', school: '을지대', studentId: '20221080', room: '108호', baseWarn: 1 },
  ];
  const userKey = (u: any) => `${u.name}·${u.room}`;
  let warnStore: Record<string, any> = {};
  try { warnStore = JSON.parse(localStorage.getItem('washed_warnings') || '{}'); } catch (e) {}
  let warnStoreChanged = false;
  userDefs.forEach((u) => {
    if (!warnStore[userKey(u)]) { warnStore[userKey(u)] = { count: u.baseWarn, suspendedUntil: null }; warnStoreChanged = true; }
    const entry = warnStore[userKey(u)];
    if (entry.suspendedUntil && now >= entry.suspendedUntil) {
      warnStore[userKey(u)] = { count: 0, suspendedUntil: null };
      warnStoreChanged = true;
    }
  });
  if (warnStoreChanged) { try { localStorage.setItem('washed_warnings', JSON.stringify(warnStore)); } catch (e) {} }

  const userRoomOptions = [{ value: '전체', label: '전체 호실' }, ...userDefs.map((u) => ({ value: u.room, label: u.room }))].map((o) => ({
    ...o, selected: (userRoomFilter || '전체') === o.value,
  }));
  const uq = (userSearch || '').trim().toLowerCase();
  const userListFiltered = userDefs.filter((u) =>
    (userRoomFilter === '전체' || u.room === userRoomFilter) && (!uq || u.name.toLowerCase().includes(uq))
  );

  const userList = userListFiltered.map((u) => {
    const entry = warnStore[userKey(u)] || { count: 0, suspendedUntil: null };
    const warnCount = entry.count;
    const suspended = !!(entry.suspendedUntil && now < entry.suspendedUntil);
    return {
      name: u.name, school: u.school, studentId: u.studentId, room: u.room, warnCount,
      warnColor: warnCount >= 3 ? '#E52222' : warnCount >= 1 ? '#9C5800' : '#37383C',
      suspended,
      suspendLabel: suspended ? '이용 제한 중' : '',
      addWarning: () => {
        try {
          const store = JSON.parse(localStorage.getItem('washed_warnings') || '{}');
          const cur = store[userKey(u)] || { count: 0, suspendedUntil: null };
          const nextCount = cur.count + 1;
          const nextEntry = nextCount >= 3
            ? { count: 3, suspendedUntil: Date.now() + 3 * 86400000 }
            : { count: nextCount, suspendedUntil: null };
          store[userKey(u)] = nextEntry;
          localStorage.setItem('washed_warnings', JSON.stringify(store));
          pushWarnLog(userKey(u), '신고 확인 · 관리자 부여');
        } catch (e) {}
        setNow(Date.now());
      },
      removeWarning: () => {
        try {
          const store = JSON.parse(localStorage.getItem('washed_warnings') || '{}');
          const cur = store[userKey(u)] || { count: 0, suspendedUntil: null };
          const nextCount = Math.max(0, cur.count - 1);
          store[userKey(u)] = { count: nextCount, suspendedUntil: nextCount >= 3 ? cur.suspendedUntil : null };
          localStorage.setItem('washed_warnings', JSON.stringify(store));
          popWarnLog(userKey(u));
        } catch (e) {}
        setNow(Date.now());
      },
      canRemoveWarning: warnCount > 0,
    };
  });

  // --- 이용 내역 ---
  const machineOrder = [
    '세탁기 1호기', '세탁기 2호기', '세탁기 3호기', '세탁기 4호기', '세탁기 5호기', '세탁기 6호기', '세탁기 7호기', '세탁기 8호기',
    '건조기 1호기', '건조기 2호기', '건조기 3호기', '건조기 4호기',
  ];
  const historyCutoff = new Date();
  historyCutoff.setMonth(historyCutoff.getMonth() - 3);
  const historyDefsAll = [
    { name: '원병찬', school: '을지대', studentId: '20231234', room: '302호', machine: '세탁기 1호기', start: '09/10 09:12', end: '09/10 10:04', status: 'done' },
    { name: '정주희', school: '을지대', studentId: '20230210', room: '210호', machine: '세탁기 2호기', start: '09/08 19:30', end: '09/08 20:22', status: 'done' },
    { name: '이서연', school: '을지대', studentId: '20221080', room: '108호', machine: '세탁기 3호기', start: '09/07 13:05', end: '09/07 13:58', status: 'done' },
    { name: '원병찬', school: '을지대', studentId: '20231234', room: '302호', machine: '세탁기 4호기', start: '09/09 20:10', end: '09/09 20:59', status: 'done' },
    { name: '서수영', school: '을지대', studentId: '20220915', room: '115호', machine: '세탁기 5호기', start: '09/06 22:14', end: '09/06 23:05', status: 'done' },
    { name: '이태연', school: '을지대', studentId: '20224120', room: '412호', machine: '세탁기 6호기', start: '09/05 11:20', end: '09/05 12:15', status: 'done' },
    { name: '정주희', school: '을지대', studentId: '20230210', room: '210호', machine: '세탁기 7호기', start: '09/04 08:02', end: '09/04 08:55', status: 'done' },
    { name: '이서연', school: '을지대', studentId: '20221080', room: '108호', machine: '세탁기 8호기', start: '09/02 17:40', end: '09/02 18:33', status: 'done' },
    { name: '이태연', school: '을지대', studentId: '20224120', room: '412호', machine: '건조기 1호기', start: '09/09 21:04', end: '09/09 21:42', status: 'warning' },
    { name: '이서연', school: '을지대', studentId: '20221080', room: '108호', machine: '건조기 2호기', start: '09/06 18:33', end: '09/06 19:11', status: 'warning' },
    { name: '서수영', school: '을지대', studentId: '20220915', room: '115호', machine: '건조기 3호기', start: '09/03 08:40', end: '09/03 09:18', status: 'done' },
    { name: '원병찬', school: '을지대', studentId: '20231234', room: '302호', machine: '건조기 4호기', start: '09/01 15:10', end: '09/01 15:48', status: 'done' },
  ];
  const historyDefs = historyDefsAll.filter((h) => parseHistoryDate(h.start) >= historyCutoff);

  const monthsPresent: string[] = [];
  historyDefs.forEach((h) => { const k = historyMonthKey(h.start); if (!monthsPresent.includes(k)) monthsPresent.push(k); });
  monthsPresent.sort().reverse();
  const historyMonthOptions = [{ value: '전체', label: '전체 기간' }, ...monthsPresent.map((m) => ({ value: m, label: `${m.split('.')[0]}년 ${Number(m.split('.')[1])}월` }))].map((o) => ({
    ...o, selected: historyMonth === o.value,
  }));

  const historyMachineOptions = [{ value: '전체', label: '전체 기기' }, ...machineOrder.map((m) => ({ value: m, label: m }))].map((o) => ({
    ...o, selected: historyMachine === o.value,
  }));

  const monthFilteredDefs = historyMonth === '전체' ? historyDefs : historyDefs.filter((h) => historyMonthKey(h.start) === historyMonth);
  const visibleMachines = historyMachine === '전체' ? machineOrder : [historyMachine];
  const machineGroups = visibleMachines
    .map((machine) => ({
      machine,
      items: monthFilteredDefs.filter((h) => h.machine === machine).map((h) => ({
        ...h,
        statusLabel: h.status === 'warning' ? '경고' : '완료',
        statusColor: h.status === 'warning' ? '#E52222' : '#37383C',
      })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Malgun Gothic', sans-serif; box-sizing: border-box; }
        a { color: #2F63B8; text-decoration: none; }
        a:hover { color: #1F4E9C; }
        input::placeholder, textarea::placeholder { color: #A8BCD9; }
        input:focus, textarea:focus { background: #fff; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#F3F6FB', color: '#171719', display: 'flex' }}>

        {/* 사이드바 메뉴 */}
        <div style={{ width: '260px', flexShrink: 0, background: '#fff', borderRight: '1px solid rgba(112,115,124,.12)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px 16px' }}>
            <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#2F63B8', whiteSpace: 'nowrap' }}>Washed&nbsp;<span style={{ color: '#171719' }}>관리자</span></div>
          </div>
          {tabs.map((t) => (
            <div key={t.key} onClick={() => setTab(t.key)} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', fontSize: '18px', fontWeight: 600, background: tab === t.key ? 'rgba(47,99,184,.08)' : 'transparent', color: tab === t.key ? '#2F63B8' : '#37383C', margin: '10px 0 0 10px', whiteSpace: 'nowrap' }}>
              {t.label}
            </div>
          ))}
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div style={{ flex: 1, minWidth: 0, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', overflowX: 'auto' }}>

          {/* 1. 실시간 기기 현황 (Dashboard) */}
          {tab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, width: '135px', height: '21px', marginBottom: '13px', whiteSpace: 'nowrap' }}>실시간 기기 현황</h1>
              {maintenanceOn && (
                <div style={{ background: 'rgba(229,34,34,.08)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#E52222' }}>점검 모드가 켜져 있어요. 모든 사용자가 줄서기를 이용할 수 없어요.</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '200px' }}>
                <div onClick={toggleMaintenance} style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', background: '#fff', borderRadius: '12px', padding: '10px 14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: maintenanceOn ? '#E52222' : '#37383C', whiteSpace: 'nowrap' }}>세탁실 점검 모드</span>
                  <div style={{ width: '40px', height: '24px', borderRadius: '999px', background: maintenanceOn ? '#E52222' : '#DFE7F1', position: 'relative', flexShrink: 0, transition: 'background .2s ease' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: maintenanceOn ? '18px' : '2px', boxShadow: '0 1px 3px rgba(20,42,84,.22)', transition: 'left .2s ease' }}></div>
                  </div>
                </div>
              </div>

              {/* 요약 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', width: '641px', height: '80px' }}>
                {summaryCards.map((c, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(55,56,60,.61)' }}>{c.label}</span>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: c.color }}>{c.value}</span>
                  </div>
                ))}
              </div>

              {/* 기기 목록 테이블 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '1020px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap' }}>기기 목록</div>
                </div>
                <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', overflow: 'hidden', width: '890px' }}>
                  
                  {/* 테이블 헤더: 원본 마진 100% 동일 적용 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr) 200px', gap: '8px', padding: '12px 16px', fontSize: '16px', fontWeight: 700, color: 'rgba(55,56,60,.61)', borderBottom: '1px solid rgba(112,115,124,.1)' }}>
                    <span style={{ width: '125px', height: '16px', whiteSpace: 'nowrap' }}>기기</span>
                    <span style={{ justifySelf: 'left', width: 'fit-content', marginLeft: '-100px', whiteSpace: 'nowrap' }}>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;상태</span>
                    <span style={{ justifySelf: 'left', width: 'fit-content', marginLeft: '20px', fontWeight: 700, whiteSpace: 'nowrap' }}>&nbsp; &nbsp; &nbsp;남은 시간</span>
                    <span style={{ justifySelf: 'start', width: 'fit-content', marginLeft: '100px', whiteSpace: 'nowrap' }}>관리</span>
                  </div>

                  {machines.map((m, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr) 200px', gap: '8px', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid rgba(112,115,124,.08)', fontSize: '13px' }}>
                      <span style={{ fontWeight: 700, width: 'fit-content', fontSize: '15px', whiteSpace: 'nowrap' }}>{m.name}</span>
                      
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'left', gap: '5px', justifySelf: 'center', width: '65px', marginLeft: '-100px', height: '16px', whiteSpace: 'nowrap' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.dot, flexShrink: 0 }}></span>
                        <span style={{ color: m.statusColor, fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap' }}>{m.statusLabel}</span>
                      </span>
                      
                      <span style={{ color: 'rgba(55,56,60,.61)', justifySelf: 'center', width: '35px', marginLeft: '20px', fontSize: '15px', height: '13px', whiteSpace: 'nowrap' }}>{m.remainingLabel}</span>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '76px 64px 64px', gap: '6px', justifySelf: 'start', marginLeft: '100px' }}>
                        <button onClick={m.toggleFault} style={m.faultBtnStyle as any}>{m.faultBtnLabel}</button>
                        {m.showForceReset ? (
                          <button onClick={m.forceReset} style={{ border: 'none', cursor: 'pointer', color: '#171719', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>초기화</button>
                        ) : (
                          <div></div>
                        )}
                        <button onClick={m.remove} style={{ border: 'none', cursor: 'pointer', color: '#E52222', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(255,66,66,.32)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 기기 추가 폼 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '10px' }}>기기 추가</div>
                <div style={{ background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', display: 'flex', gap: '8px', width: '892px', height: '61px' }}>
                  <input value={newMachineName} onChange={(e) => setNewMachineName(e.target.value)} placeholder={newMachineType === 'dryer' ? '예: 건조기 5호기' : '예: 세탁기 9호기'} style={{ border: 'none', outline: 'none', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '8px 12px', fontSize: '13px', width: '160px' }} />
                  <div style={{ display: 'flex', gap: '4px', background: '#EAEBEC', borderRadius: '10px', padding: '3px' }}>
                    {[{ key: 'washer', label: '세탁기' }, { key: 'dryer', label: '건조기' }].map((o) => (
                      <div key={o.key} onClick={() => setNewMachineType(o.key)} style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: newMachineType === o.key ? '#fff' : 'transparent', color: newMachineType === o.key ? '#171719' : 'rgba(55,56,60,.61)' }}>{o.label}</div>
                    ))}
                  </div>
                  <button onClick={() => { if (newMachineName.trim() && newMachineName.includes(newMachineType === 'dryer' ? '건조기' : '세탁기')) setConfirmAddOpen(true); }} disabled={!newMachineName.trim() || !newMachineName.includes(newMachineType === 'dryer' ? '건조기' : '세탁기')} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#2F63B8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', opacity: (!newMachineName.trim() || !newMachineName.includes(newMachineType === 'dryer' ? '건조기' : '세탁기')) ? 0.5 : 1 }}>기기 추가</button>
                </div>
              </div>
            </div>
          )}

          {/* 2. 실시간 대기열 현황 (Queue) */}
          {tab === 'queue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>실시간 대기열 현황</h1>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {typeQueues.map((tq, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800 }}>{tq.label} 대기열</span>
                      {tq.hasWaiting && <span style={{ fontSize: '12px', fontWeight: 700, color: tq.badgeColor, background: tq.badgeBg, padding: '4px 10px', borderRadius: '999px' }}>{tq.badgeLabel}</span>}
                    </div>

                    {tq.hasWaiting ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '30px', fontWeight: 800, color: '#2F63B8', lineHeight: 1 }}>{tq.count}</span>
                          <span style={{ fontSize: '13px', color: 'rgba(55,56,60,.61)' }}>명 대기 중</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(55,56,60,.61)' }}>
                            <span>대기 혼잡도</span><span>{tq.loadLabel}</span>
                          </div>
                          <div style={{ height: '7px', borderRadius: '4px', background: '#EDEEF0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '4px', background: tq.barColor, width: tq.loadPct }}></div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ background: '#F7F7F8', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(55,56,60,.5)' }}>다음 배정까지</span>
                            <span style={{ fontSize: '15px', fontWeight: 700 }}>{tq.waitLabel}</span>
                          </div>
                          <div style={{ background: '#F7F7F8', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(55,56,60,.5)' }}>1인당 평균 대기</span>
                            <span style={{ fontSize: '15px', fontWeight: 700 }}>{tq.avgWaitLabel}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(55,56,60,.61)' }}>대기 순번</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {tq.rows.map((row: any, rIdx: number) => (
                              <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', background: row.rowBg }}>
                                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: row.badgeBg, color: row.badgeFg, fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{row.pos}</span>
                                <span style={{ fontSize: '12.5px', color: '#37383C', flex: 1 }}>{row.text}</span>
                                <span style={{ fontSize: '11.5px', color: 'rgba(55,56,60,.5)', flexShrink: 0 }}>{row.eta}</span>
                              </div>
                            ))}
                            {tq.hasMore && <span style={{ fontSize: '11.5px', color: 'rgba(55,56,60,.45)', paddingLeft: '2px' }}>외 {tq.moreCount}명 대기 중</span>}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(55,56,60,.5)' }}>대기 중인 사람이 없어요</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 신고 내역 (Reports) */}
          {tab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>신고 내역</h1>
              <div style={{ display: 'flex', gap: '6px', width: 'max-content' }}>
                {reportFilters.map((f, i) => (
                  <div key={i} onClick={f.onClick} style={f.style as any}>{f.label}</div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reportGroups.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(55,56,60,.5)', width: '1190px', height: '71px' }}>
                    {reportFilter === '접수됨' ? '현재 접수된 신고 내역이 없습니다.' : reportFilter === '처리중' ? '현재 처리중인 신고 내역이 없습니다.' : reportFilter === '처리완료' ? '현재 처리완료된 신고 내역이 없습니다.' : '현재 신고 내역이 없습니다.'}
                  </div>
                ) : (
                  reportGroups.map((grp, gIdx) => (
                    <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(55,56,60,.5)' }}>{grp.label}</span>
                      <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', overflow: 'hidden' }}>
                        {grp.items.map((r: any, rIdx: number) => (
                          <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: '1px solid rgba(112,115,124,.08)' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(47,99,184,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {r.isFault && <div style={{ position: 'relative', width: '24px', height: '24px' }}><img src="/icons/washer-fault.svg" alt="" style={{ width: '24px', height: '24px' }} /><div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: '#E52222', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>!</div></div>}
                              {r.isOrder && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F63B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3.5" width="14" height="18" rx="2"></rect><rect x="9" y="1.8" width="6" height="3.2" rx="1"></rect><line x1="8.5" y1="10" x2="13.5" y2="10"></line><line x1="8.5" y1="13.2" x2="12" y2="13.2"></line><circle cx="16.2" cy="15.8" r="3.3"></circle><line x1="14.5" y1="17.5" x2="17.9" y2="14.1"></line></svg>}
                              {r.isLaundry && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F63B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5v3"></path><path d="M9 3.5l1 2.3"></path><path d="M15 3.5l-1 2.3"></path><path d="M6.2 9h11.6l-1.3 10.2a2 2 0 0 1-2 1.8H9.5a2 2 0 0 1-2-1.8L6.2 9Z"></path><path d="M4.5 9h15"></path><path d="M9.5 12.5v5"></path><path d="M14.5 12.5v5"></path></svg>}
                              {r.isEtc && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F63B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5h13a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2h-6l-4 3v-3H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"></path><circle cx="7.3" cy="9.6" r=".6" fill="#2F63B8" stroke="none"></circle><circle cx="10.3" cy="9.6" r=".6" fill="#2F63B8" stroke="none"></circle><circle cx="13.3" cy="9.6" r=".6" fill="#2F63B8" stroke="none"></circle><circle cx="19.5" cy="5" r="3.2" fill="#fff"></circle><line x1="19.5" y1="3.5" x2="19.5" y2="6.5"></line><line x1="18" y1="5" x2="21" y2="5"></line></svg>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700 }}>{r.reason}{r.hasDetail && ` · ${r.detail}`}</span>
                              <span style={{ fontSize: '12px', color: 'rgba(55,56,60,.61)' }}>{r.datetime} · 신고자: {r.reporter}</span>
                            </div>
                            <div onClick={r.advance} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: r.statusBg, cursor: r.statusCursor }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: r.statusDot }}></span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: r.statusFg }}>{r.statusLabel}</span>
                            </div>
                            {r.showReject && (
                              <button onClick={r.reject} style={{ border: 'none', cursor: 'pointer', color: '#E52222', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(229,34,34,.32)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>반려</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. 이용 내역 (History) */}
          {tab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>이용 내역</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '150px' }}>
                  <select value={historyMachine} onChange={(e) => setHistoryMachine(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '10px 34px 10px 14px', fontSize: '13px', fontWeight: 600, background: '#fff', color: '#171719', appearance: 'none', cursor: 'pointer' }}>
                    {historyMachineOptions.map((mo, i) => (
                      <option key={i} value={mo.value}>{mo.label}</option>
                    ))}
                  </select>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#5A7CA8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <div style={{ position: 'relative', minWidth: '130px' }}>
                  <select value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '10px 34px 10px 14px', fontSize: '13px', fontWeight: 600, background: '#fff', color: '#171719', appearance: 'none', cursor: 'pointer' }}>
                    {historyMonthOptions.map((mo, i) => (
                      <option key={i} value={mo.value}>{mo.label}</option>
                    ))}
                  </select>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#5A7CA8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {machineGroups.map((mg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{mg.machine}</span>
                    <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 0.8fr', gap: '8px', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'rgba(55,56,60,.61)', borderBottom: '1px solid rgba(112,115,124,.1)' }}>
                        <span>사용자</span><span>학번</span><span>소속·호실</span><span>시작</span><span>종료</span><span>상태</span>
                      </div>
                      {mg.items.map((h: any, hIdx: number) => (
                        <div key={hIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 0.8fr', gap: '8px', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid rgba(112,115,124,.08)', fontSize: '13px' }}>
                          <span style={{ fontWeight: 700 }}>{h.name}</span>
                          <span style={{ color: 'rgba(55,56,60,.61)' }}>{h.studentId}</span>
                          <span style={{ color: 'rgba(55,56,60,.61)' }}>{h.school} · {h.room}</span>
                          <span style={{ color: 'rgba(55,56,60,.61)' }}>{h.start}</span>
                          <span style={{ color: 'rgba(55,56,60,.61)' }}>{h.end}</span>
                          <span style={{ fontWeight: 600, color: h.statusColor }}>{h.statusLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {machineGroups.length === 0 && <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'rgba(55,56,60,.5)' }}>검색 결과가 없어요</div>}
              </div>
            </div>
          )}

          {/* 5. 경고 누적 사용자 (Warnings) */}
          {tab === 'warnings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>경고 누적 사용자</h1>
              <div style={{ position: 'relative', width: 'max-content', zIndex: 20 }}>
                <div onClick={() => setWarnMonthMenuOpen(!warnMonthMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '10px 14px', cursor: 'pointer', minWidth: '150px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#171719', flex: 1, whiteSpace: 'nowrap' }}>{monthLabel(selectedWarnMonth)}</span>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ flexShrink: 0, transform: warnMonthMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .18s ease' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#5A7CA8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                {warnMonthMenuOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: '100%', background: '#fff', borderRadius: '12px', boxShadow: '0 8px 24px -6px rgba(23,23,23,.22), inset 0 0 0 1px rgba(112,115,124,.12)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '260px', overflowY: 'auto' }}>
                    {warnMonthOptions.map((mo, i) => (
                      <div key={i} onClick={mo.onClick} style={{ padding: '9px 12px', borderRadius: '9px', fontSize: '13px', fontWeight: mo.weight as any, color: mo.color, background: mo.bg, cursor: 'pointer', whiteSpace: 'nowrap' }}>{mo.label}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', overflow: 'hidden' }}>
                {warningUsers.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(55,56,60,.5)' }}>해당 월에 경고 누적 사용자가 없습니다.</div>
                ) : (
                  warningUsers.map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderBottom: '1px solid rgba(112,115,124,.08)', background: w.rowBg }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>{w.name}</span>
                          {w.showBanInfo && <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#fff', background: '#E52222', borderRadius: '5px', padding: '2px 6px' }}>이용정지</span>}
                        </div>
                        <span style={{ fontSize: '12px', color: 'rgba(55,56,60,.61)' }}>{w.school} · {w.studentId} · {w.room}</span>
                        {w.hasReasons && (
                          <span style={{ fontSize: '11.5px', color: 'rgba(55,56,60,.5)', marginTop: '3px' }}>
                            {w.recentLine}
                            {w.hasMore && <span onClick={w.toggleMore} style={{ color: '#2F63B8', fontWeight: 700, cursor: 'pointer' }}> {w.moreLabel}</span>}
                          </span>
                        )}
                        {w.expanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                            {w.restReasons.map((rs: any, rIdx: number) => (
                              <span key={rIdx} style={{ fontSize: '11.5px', color: 'rgba(55,56,60,.5)' }}>{rs.when} · {rs.text}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {w.steps.map((st: any, sIdx: number) => (
                            <span key={sIdx} style={{ width: '22px', height: '6px', borderRadius: '3px', background: st.bg }}></span>
                          ))}
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: w.color }}>{w.gaugeLabel}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. 공지사항 (Notice) */}
          {tab === 'notice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>공지사항</h1>
              <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', display: 'flex', flexDirection: 'column', gap: '12px', width: '586px', height: '214px' }}>
                <input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="공지 제목" style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: 'inset 0 0 0 1px #E3EBF7', background: '#F6F9FE', padding: '13px 14px', fontSize: '14px', color: '#1E3557' }} />
                <textarea value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} placeholder="공지 내용" style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: 'inset 0 0 0 1px #E3EBF7', background: '#F6F9FE', padding: '13px 14px', fontSize: '14px', color: '#1E3557', minHeight: '80px', resize: 'none', fontFamily: 'inherit' }}></textarea>
                <button onClick={() => { if (noticeTitle.trim()) setConfirmPostOpen(true); }} style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', color: '#fff', background: '#2F63B8', borderRadius: '10px', padding: '9px 18px', fontSize: '13px', fontWeight: 700 }}>등록</button>
              </div>

              <div style={{ position: 'relative', minWidth: '150px', width: '140px', height: '37px' }}>
                <select value={noticeMonth} onChange={(e) => setNoticeMonth(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '10px 34px 10px 14px', fontSize: '13px', fontWeight: 600, background: '#fff', color: '#171719', appearance: 'none', cursor: 'pointer' }}>
                  {noticeMonthOptions.map((mo, i) => (
                    <option key={i} value={mo.value}>{mo.label}</option>
                  ))}
                </select>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#8FAAD0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {filteredNotices.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(55,56,60,.5)' }}>해당 월에 등록된 공지사항이 없습니다.</div>
                ) : (
                  filteredNotices.map((n, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.4 }}>{n.title}</span>
                        <button onClick={() => setConfirmNotice(n)} style={{ border: 'none', cursor: 'pointer', background: 'transparent', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E52222" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"></path><path d="M9.5 7V4.5h5V7"></path><path d="M6.5 7l1 13h9l1-13"></path><path d="M10.5 10.5v6"></path><path d="M13.5 10.5v6"></path></svg>
                        </button>
                      </div>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.61)', lineHeight: 1.6 }}>{n.body}</span>
                      <span style={{ fontSize: '11px', color: 'rgba(55,56,60,.4)', marginTop: '2px' }}>{n.date}{n.time ? ` ${n.time}` : ''}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 7. 사용자 목록 (Users) */}
          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>사용자 목록</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="이름으로 검색" style={{ border: 'none', outline: 'none', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '10px 14px', fontSize: '13px', width: '220px' }} />
                <div style={{ position: 'relative', minWidth: '130px' }}>
                  <select value={userRoomFilter} onChange={(e) => setUserRoomFilter(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', padding: '10px 34px 10px 14px', fontSize: '13px', fontWeight: 600, background: '#fff', color: '#171719', appearance: 'none', cursor: 'pointer' }}>
                    {userRoomOptions.map((ro, i) => (
                      <option key={i} value={ro.value}>{ro.label}</option>
                    ))}
                  </select>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#5A7CA8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0px 1px 2px -1px rgba(23,23,23,.1)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 0.8fr 1fr', gap: '8px', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'rgba(55,56,60,.61)', borderBottom: '1px solid rgba(112,115,124,.1)' }}>
                  <span>이름</span><span>소속</span><span>학번</span><span>호실</span><span>경고</span><span>관리</span>
                </div>
                {userList.map((u, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 0.8fr 1fr', gap: '8px', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid rgba(112,115,124,.08)', fontSize: '13px' }}>
                    <span style={{ fontWeight: 700 }}>{u.name}</span>
                    <span style={{ color: 'rgba(55,56,60,.61)' }}>{u.school}</span>
                    <span style={{ color: 'rgba(55,56,60,.61)' }}>{u.studentId}</span>
                    <span style={{ color: 'rgba(55,56,60,.61)' }}>{u.room}</span>
                    <span style={{ fontWeight: 700, color: u.warnColor }}>{u.warnCount}회{u.suspended ? ` · ${u.suspendLabel}` : ''}</span>
                    <div style={{ display: 'flex', gap: '6px', justifySelf: 'start' }}>
                      <button onClick={u.addWarning} style={{ border: 'none', cursor: 'pointer', color: '#9C5800', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(217,131,36,.35)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>경고 +1</button>
                      <button onClick={u.removeWarning} disabled={!u.canRemoveWarning} style={{ border: 'none', cursor: u.canRemoveWarning ? 'pointer' : 'default', color: u.canRemoveWarning ? '#5A7CA8' : '#C3D2E6', background: 'transparent', boxShadow: `inset 0 0 0 1px ${u.canRemoveWarning ? 'rgba(112,115,124,.2)' : 'rgba(112,115,124,.1)'}`, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>경고 -1</button>
                    </div>
                  </div>
                ))}
                {userList.length === 0 && <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'rgba(55,56,60,.5)' }}>검색 결과가 없어요</div>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* --- 각종 확인 모달들 --- */}
      {confirmPostOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '340px', background: '#fff', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,20,22,.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>공지사항을 등록하시겠습니까?</span>
              <span style={{ fontSize: '13px', color: 'rgba(55,56,60,.61)', lineHeight: 1.5, textAlign: 'center' }}>&quot;{noticeTitle}&quot; 공지가 모든 사용자에게 게시됩니다.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmPostOpen(false)} style={{ border: 'none', cursor: 'pointer', color: '#171719', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>취소</button>
              <button onClick={() => {
                const d = new Date();
                const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                const next = [{ title: noticeTitle, body: noticeBody, date: dateStr, time: timeStr, ts: d.getTime() }, ...notices];
                saveNotices(next);
                setNotices(next);
                setNoticeTitle('');
                setNoticeBody('');
                setConfirmPostOpen(false);
              }} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#2F63B8', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>등록</button>
            </div>
          </div>
        </div>
      )}

      {confirmNotice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '340px', background: '#fff', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,20,22,.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>해당 공지사항을 삭제하시겠습니까?</span>
              <span style={{ fontSize: '13px', color: 'rgba(55,56,60,.61)', lineHeight: 1.5, textAlign: 'center' }}>&quot;{confirmNotice.title}&quot; 공지가 목록에서 삭제됩니다.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmNotice(null)} style={{ border: 'none', cursor: 'pointer', color: '#171719', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>취소</button>
              <button onClick={() => {
                const next = notices.filter((x) => x !== confirmNotice);
                saveNotices(next);
                setNotices(next);
                setConfirmNotice(null);
              }} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#E52222', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {confirmAddOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '340px', background: '#fff', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,20,22,.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>{newMachineName.trim()}을(를) 추가하시겠습니까?</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmAddOpen(false)} style={{ border: 'none', cursor: 'pointer', color: '#171719', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>취소</button>
              <button onClick={() => {
                if (!newMachineName.trim()) return;
                const lastOfType = [...baseRaw, ...extraMachines].filter((r) => !removedIds[r.id] && r.type === newMachineType).pop();
                setExtraMachines([...extraMachines, { id: `x${Date.now()}`, type: newMachineType, name: newMachineName.trim(), status: 'available', remaining: 0, insertAfter: lastOfType ? lastOfType.id : null }]);
                setNewMachineName('');
                setConfirmAddOpen(false);
              }} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#2F63B8', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '340px', background: '#fff', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,20,22,.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>기기를 삭제하시겠습니까?</span>
              <span style={{ fontSize: '13px', color: 'rgba(55,56,60,.61)', lineHeight: 1.5 }}>{confirmRemoveName}을(를) 목록에서 삭제합니다.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setConfirmRemoveId(null); setConfirmRemoveName(''); }} style={{ border: 'none', cursor: 'pointer', color: '#171719', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(112,115,124,.16)', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>취소</button>
              <button onClick={() => {
                setRemovedIds((st) => ({ ...st, [confirmRemoveId]: true }));
                setConfirmRemoveId(null);
                setConfirmRemoveName('');
              }} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#E52222', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { logoutAction } from './login/actions';
import AdminTabs from '@/components/admin/tabs';
import { requireAdmin } from '@/lib/admin-session';
import {
  adminHistory,
  adminMachines,
  adminNotices,
  adminQueue,
  adminReports,
  adminUsers,
  adminWarnings,
} from '@/lib/admin-actions';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'dashboard', label: '실시간 기기 현황' },
  { key: 'queue', label: '실시간 대기열 현황' },
  { key: 'reports', label: '신고 내역' },
  { key: 'history', label: '이용 내역' },
  { key: 'warnings', label: '경고 누적 사용자' },
  { key: 'notice', label: '공지사항' },
  { key: 'users', label: '사용자 목록' },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : 'dashboard';

  // 탭마다 필요한 것만 읽는다 — 일곱 개를 매번 다 읽지 않는다
  const data = {
    machines: tab === 'dashboard' ? await adminMachines() : [],
    queue: tab === 'queue' ? await adminQueue() : [],
    reports: tab === 'reports' ? await adminReports() : [],
    history: tab === 'history' ? await adminHistory() : [],
    warnings: tab === 'warnings' ? await adminWarnings() : [],
    notices: tab === 'notice' ? await adminNotices() : [],
    users: tab === 'users' ? await adminUsers() : [],
  };

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#F3F6FB' }}>
      {/* 사이드바 */}
      <aside
        style={{
          width: 226,
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #EAF0FA',
          padding: '22px 14px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#2F63B8',
            letterSpacing: -0.4,
            padding: '0 10px 18px',
            whiteSpace: 'nowrap',
          }}
        >
          Washed 관리자
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/admin?tab=${t.key}`}
                style={{
                  padding: '11px 12px',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: on ? 700 : 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  background: on ? 'rgba(47,99,184,.08)' : 'transparent',
                  color: on ? '#2F63B8' : '#37383C',
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <div
            style={{
              fontSize: 11.5,
              color: '#A8BCD9',
              padding: '0 12px 10px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {admin.loginId}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #E3EBF7',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#5A6E8F',
              }}
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* 본문 — 표가 창보다 넓으면 가로 스크롤 (2026-09-15 갱신) */}
      <main style={{ flex: 1, minWidth: 0, overflowX: 'auto', padding: '26px 24px' }}>
        <h1
          style={{
            margin: '0 0 20px',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.4,
            color: '#1E3557',
            whiteSpace: 'nowrap',
          }}
        >
          {TABS.find((t) => t.key === tab)?.label}
        </h1>

        <AdminTabs tab={tab} data={data} />
      </main>
    </div>
  );
}
