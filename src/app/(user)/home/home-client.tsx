'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useUnreadCount } from '@/lib/use-unread-count';
import NotificationPrompt from '@/components/notification-prompt';
import QrScanner, { type QrVerifiedResult } from './qr-scanner';
import { useRouter } from 'next/navigation';
import { PICKUP_GRACE_MINUTES } from '@/lib/assignment-rules';
import { useApiError, useT } from '@/lib/i18n/use-t';

// --- 전역 상수 (타이머 시간 등) ---
//
// **배정 10분(05 P3)은 여기 없다.** 배정 마감 시각은 서버가 정해 assign_deadline_at
// 으로 내려주고, 화면은 「서버가 준 마감 − 지금」만 그린다 (08 · 4번 · Issue #5).
// 아래 60분 · 45분 · 3분도 서버가 판정한다(machines.ends_at · queue.pickup_deadline_at ·
// Issue #6 · #7). 다만 서버의 「사용중 → 수거대기」 전환(expiration.ts::
// transitionUsageToPickup)은 폴링·스윕 주기만큼 늦게 도착하므로, 화면은 서버가 준
// endsAt 을 기준으로 러닝 · 수거대기 전환을 **직접 계산**해 그 지연 없이 그린다 —
// 실제 종료 처리 · 강제 종료 · 경고 판정은 전부 서버 몫이다.
const RUN_MS_WASHER = 60 * 60 * 1000;
const RUN_MS_DRYER = 45 * 60 * 1000;
// 05 P5 의 수거 유예. 값은 서버 정책 상수 하나만 본다 — 화면이 3분을 따로 적어 두면
// 서버가 찍는 pickup_deadline_at 과 소리 없이 어긋난다 (Issue #85).
const GRACE_MS = PICKUP_GRACE_MINUTES * 60 * 1000;
const runMsFor = (type: string) => (type === 'dryer' ? RUN_MS_DRYER : RUN_MS_WASHER);

/** 서버가 정한 배정 결과를 받아 오는 주기 (05 P2 — 앞사람이 끝나면 내 차례가 온다) */
const POLL_MS = 5000;

/**
 * 서버의 「사용중 → 수거대기」 전환을 부르는 주기 (F9 · 05 P5 · Issue #35).
 *
 * **POLL_MS 와 같은 값을 쓴다.** Issue #35 는 refactor다 — 조회(GET)와 상태 변경
 * (POST)의 책임을 가르는 것이 목적이고, 사용자가 느끼는 타이밍을 바꾸는 것이 아니다.
 * 예전에는 GET /api/queue 가 조회와 전환을 함께 했으므로 전환과 종료 알림(#12)이
 * 5초 안에 닿았다. 스윕 주기를 늘리면 그만큼 알림이 늦어지므로 같은 5초로 둔다.
 *
 * POLL_MS 를 참조하지 않고 값을 따로 적는 이유는 **뜻이 다르기 때문이다** — 위는
 * 조회 주기, 이쪽은 쓰기 주기다. 지금 값이 같은 것은 기존 동작을 유지하기 때문이고,
 * Issue #8 에서 서버 스케줄러가 완성되면 이 클라이언트 스윕 자체를 없애거나 주기를
 * 다시 설계한다 — 그때 조회 주기(POLL_MS)까지 함께 끌려가면 안 된다.
 */
const SWEEP_MS = 5000;

type ApiMachine = { id: string; type: string; name: string; status: string; remaining: number };
type ApiQueueCounts = { washer: number; dryer: number };
type ApiQueueEntry = {
  status: 'waiting' | 'assigned' | 'inuse' | 'pickup';
  machineId: string | null;
  machineName: string | null;
  assignedAt: string | null;
  assignDeadlineAt: string | null;
  pickupDeadlineAt: string | null;
  /** F8 — QR 인증 성공 뒤 서버가 찍은 종료 예정 시각(05 P4). 사용중이 아니면 null */
  endsAt: string | null;
  queuedAt: string;
  /** 05 P2 — 내 앞에 남은 대기 인원 */
  ahead: number;
  /** 05 P2 — 그 종류에서 가장 먼저 끝나는 기기의 종료 예정 시각 (없으면 null) */
  estimatedTurnAt: string | null;
};
type ApiMine = { washer: ApiQueueEntry | null; dryer: ApiQueueEntry | null };

export default function HomeClient() {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  // 세션이 authenticated 로 확정되기 전에는 이름을 비워 둔다 — 로딩 중
  // 잘못된 이름(빈 값 → 실제 이름)이 잠깐 깜빡이지 않도록 한다. (#32)
  const { data: session, status: sessionStatus } = useSession();
  const myName = sessionStatus === 'authenticated' ? session?.user?.name || '' : '';

  // --- 상태 관리 ---
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [typeFilter, setTypeFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [warningId, setWarningId] = useState<string | null>(null);
  // 05 P3 「배정 해제 안내 모달」. **Issue #5 에서는 아무 데서도 띄우지 않는다** —
  // 10분이 지났는지를 화면이 판정하면 브라우저 시계로 제재가 갈리고, 앱을 켜지
  // 않은 사람에게는 아예 일어나지 않는다(08 · 4번). 서버가 배정을 해제한 것을
  // 확인하고 띄우는 일은 Issue #8 이 맡는다 — 모달은 그때 쓰도록 남겨 둔다.
  const [expiredOpen, setExpiredOpen] = useState(false);

  // 서버가 정한 내 줄서기 상태 (05 P2 · P3). 화면은 이 값을 **그리기만** 한다 —
  // 배정 여부 · 배정 마감을 클라이언트가 스스로 정하지 않는다 (08 · 3번 · 4번).
  const [mine, setMine] = useState<ApiMine>({ washer: null, dryer: null });
  // 서버 시각과 브라우저 시각의 차이. 카운트다운을 서버 기준으로 보정한다.
  const [clockSkewMs, setClockSkewMs] = useState(0);

  const [queueCounts, setQueueCounts] = useState<ApiQueueCounts>({ washer: 0, dryer: 0 });
  const [rawMachines, setRawMachines] = useState<ApiMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // 05 P20 · 06 「세탁실」 · F33 · Issue #47 — 기기 단위 점검(개별 배지)과 별개인
  // 세탁실 전체 점검 상태. 서버가 판정하고 화면은 그리기만 한다.
  const [facilityUnderInspection, setFacilityUnderInspection] = useState(false);

  // 종의 점은 DB 가 센다 (F18 · 05 P14 — 보관 기간까지 서버가 건다).
  const unreadCount = useUnreadCount();
  const hasUnread = unreadCount > 0;

  // --- 기기 목록 · 대기 인원 조회 (F1 · F2 · 05 P2) ---
  const loadMachines = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/machines', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRawMachines(data.machines);
      setQueueCounts(data.queueCounts);
      setFacilityUnderInspection(Boolean(data.facilityUnderInspection));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 내 줄서기 상태 (F3 · F5 · F6 · F7) ---
  //
  // 서버가 기억하므로 새로고침해도 유지되고, **앞사람이 끝나 내 차례가 된 것(F5)도
  // 이 조회로만 화면에 닿는다** — 클라이언트가 스스로 판단하지 않는다 (08 · 3번).
  const loadMine = useCallback(async () => {
    try {
      const res = await fetch('/api/queue', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setMine(data.mine as ApiMine);
      if (data.serverNow) {
        setClockSkewMs(new Date(data.serverNow).getTime() - Date.now());
      }
    } catch {
      // 조회 실패는 기존 값을 그대로 두고 다음 폴링에서 다시 맞춘다.
    }
  }, []);

  // --- 사용 타이머 종료 스윕 (F9 · 05 P5 · Issue #35) ---
  //
  // 조회가 아니라 **명시적인 상태 변경 요청**이라 위의 두 조회와 분리해 둔다. 전역
  // 스윕이므로 내 줄만이 아니라 만료된 줄 전체가 전환된다 — 예전에 GET /api/queue 가
  // 갖고 있던 성질 그대로다. 실패해도 삼키는 이유는 ① 다음 스윕이 다시 시도하고
  // ② 조회는 이 요청과 독립이라 화면이 깨지지 않기 때문이다(Issue #35 의 목적).
  const runSweep = useCallback(async () => {
    try {
      const res = await fetch('/api/queue/sweep', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      // 전환된 줄이 있을 때만 다시 읽는다 — 없으면 화면에 바뀔 것이 없다.
      if (data?.transitioned > 0) {
        loadMine();
        loadMachines();
      }
    } catch {
      // 다음 스윕에서 다시 시도한다.
    }
  }, [loadMine, loadMachines]);

  useEffect(() => {
    loadMachines();
    loadMine();
    // 화면을 열 때 한 번 훑는다 — 예전에 첫 조회가 겸했던 자리다.
    runSweep();
  }, [loadMachines, loadMine, runSweep]);

  // 주기적으로 서버 상태를 다시 읽는다. **이 폴링이 없으면 서버가 배정을 올려도
  // 열려 있는 화면에는 영원히 닿지 않는다** — 예전처럼 한 번만 읽고 나머지를 화면이
  // 시뮬레이션하면 F5(앞사람 종료로 내 차례가 됨)가 성립하지 않는다.
  useEffect(() => {
    const id = setInterval(() => {
      loadMine();
      loadMachines();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loadMine, loadMachines]);

  // 쓰기는 조회와 **같은 주기지만 별도 요청**으로 나간다 (SWEEP_MS 주석 참고) —
  // 한쪽이 실패해도 다른 쪽은 그대로 돈다. 이것이 Issue #35 가 가른 지점이다.
  useEffect(() => {
    const id = setInterval(runSweep, SWEEP_MS);
    return () => clearInterval(id);
  }, [runSweep]);

  // --- 알림(Toast) 함수 ---
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  // --- 실시간 타이머 ---
  //
  // **배정(10분)은 여기서 만료시키지 않는다.** 05 P3 의 「넘기면 배정이 해제되어 다음
  // 사람에게 넘어가고 경고 1회가 누적된다」는 화면이 켜져 있어야 일어나는 일이면
  // 안 된다(08 · 4번 — 「앱을 안 켠 사람도 경고를 받아야 한다」). 서버 스케줄러가
  // 맡는다(Issue #8). 여기서는 남은 시간을 그릴 뿐이고, 마감이 지나면 0:00 에서
  // 멈춘 채 다음 폴링이 서버 판정을 가져오기를 기다린다.
  //
  // 사용중 → 수거대기 전환(F9)과 "다했어요" 처리(F10)는 서버가 한다
  // (usage.ts::expireRunTimers · finishUsage, Issue #7). 여기서는 서버가 준 endsAt 과
  // 이 tick 이 갱신하는 serverNow 를 비교해 러닝 · 수거대기 화면을 그릴 뿐이다 —
  // 그래서 서버의 상태 전환(최대 5초 폴링 지연)을 기다리지 않고도 타이머가 0 이
  // 되는 즉시 빨간 수거대기 화면으로 바뀐다(아래 myCurrent).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // --- 핸들러 함수 ---

  // F3 · F4 — 줄서기는 서버가 판정한다(05 P1 · P2 · P3 · P7 · P20).
  //
  // 빈 기기가 있고 내 앞에 아무도 없으면 서버가 그 자리에서 배정해 돌려주고, 아니면
  // 대기 중으로 등록된다. **화면은 어느 쪽인지 스스로 계산하지 않고** 응답을 그대로
  // 반영한 뒤 서버 상태를 다시 읽는다.
  const autoJoin = async (type: string, label: string) => {
    try {
      const res = await fetch(`/api/queue/${type}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        showToast(apiError(data, t('home.joinFailed', { label })));
        return;
      }

      if (data.status === 'assigned') {
        showToast(t('home.assignedNow', { machine: data.machineName ?? label }));
      } else {
        showToast(t('home.joinedQueue', { label }));
      }
      // 배정 · 대기 어느 쪽이든 서버가 가진 값이 기준이다.
      loadMine();
      loadMachines();
    } catch {
      showToast(t('home.joinNetworkError'));
    }
  };

  // F7 — 줄 빠지기도 서버가 막는다(05 P3 — 배정 상태에서는 불가).
  const leaveType = async (type: string, label: string) => {
    try {
      const res = await fetch(`/api/queue/${type}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(apiError(data, t('home.leaveFailed', { label })));
        loadMine();
        if (res.status === 403) loadMachines();
        return;
      }

      showToast(t('home.leftQueue', { label }));
      loadMine();
      loadMachines();
    } catch {
      showToast(t('home.leaveNetworkError'));
    }
  };

  // F8 — QR 인증. 카메라가 디코딩한 값을 QrScanner 가 /api/queue/verify-qr 로 보내
  // 서버가 「배정된 사람인가 · 그 기기가 맞는가 · 10분이 지나지 않았는가」를 판정한
  // 뒤 여기로 결과를 돌려준다 — 종료 예정 시각(세탁 60분 · 건조 45분)도 서버가
  // 정한 값이고, 클라이언트는 그리기만 한다(05 P4 · 10번 요구사항).
  const handleQrVerified = (result: QrVerifiedResult) => {
    setScanningId(null);
    setClockSkewMs(new Date(result.serverNow).getTime() - Date.now());
    showToast(t('home.qrVerified', { machine: result.machineName ?? t('home.machineFallback') }));
    loadMine();
    loadMachines();
  };

  // F10 — "다했어요"는 서버가 판정한다(05 P5 · P6 · Issue #7). 남은 시간과
  // 관계없이 그 자리에서 종료되고, 대기자가 있으면 곧바로 다음 사람에게 넘어간다.
  const finish = async (machineId: string, name: string) => {
    try {
      const res = await fetch('/api/queue/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(apiError(data, t('home.finishFailed', { name })));
        loadMine();
        return;
      }

      showToast(t('home.finished', { name }));
      loadMine();
      loadMachines();
    } catch {
      showToast(t('home.finishNetworkError'));
    }
  };

  // --- 화면 렌더링용 연산 ---
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // 서버 기준 시각. 카운트다운은 전부 이 값으로 그린다 — 브라우저 시계를 앞당겨도
  // 남은 시간이 바뀌지 않는다 (08 · 4번).
  const serverNow = now + clockSkewMs;

  // --- 서버가 준 배정 (05 P2 · P3) ---
  // 배정된 기기의 id → 마감 시각. 화면이 만드는 값이 아니라 서버가 준 값이다.
  const assignedByMachineId = new Map<string, { name: string; deadline: number | null }>();
  (['washer', 'dryer'] as const).forEach((type) => {
    const entry = mine[type];
    if (entry?.status === 'assigned' && entry.machineId) {
      assignedByMachineId.set(entry.machineId, {
        name: entry.machineName ?? '',
        deadline: entry.assignDeadlineAt ? new Date(entry.assignDeadlineAt).getTime() : null,
      });
    }
  });

  // --- 서버가 준 사용 중 (F8 · F9 · F10 · 05 P4 · P5) ---
  // 상태가 inuse(사용중) · pickup(수거대기)이면 그 기기는 내가 쓰는 중이다. endsAt 은
  // 서버가 QR 인증 때 찍은 종료 예정 시각 — 러닝 · 수거대기 전환(F9)을 그릴 때
  // 이 값과 serverNow 만 비교한다(서버의 상태 전환을 기다리지 않는다).
  const inUseByMachineId = new Map<string, { type: 'washer' | 'dryer'; name: string; endsAt: number }>();
  (['washer', 'dryer'] as const).forEach((type) => {
    const entry = mine[type];
    if ((entry?.status === 'inuse' || entry?.status === 'pickup') && entry.machineId && entry.endsAt) {
      inUseByMachineId.set(entry.machineId, {
        type,
        name: entry.machineName ?? '',
        endsAt: new Date(entry.endsAt).getTime(),
      });
    }
  });

  /** 서버 배정(내 것) 또는 서버가 사용중 · 수거대기로 판정한 것이면 그 기기는 내가 쓰는 중이다 */
  const isMineNow = (id: string) => assignedByMachineId.has(id) || inUseByMachineId.has(id);

  // 05 P20 · 06 「세탁실」 · Issue #47 — 세탁실 전체 점검 중에는 내가 이미 쓰고
  // 있는 기기를 뺀 나머지를 화면에서 전부 "점검 중"으로 보여준다. machines.status
  // (실제 값)는 바꾸지 않으므로 점검 해제 즉시 각 기기의 실제 상태로 돌아온다.
  const effectiveStatus = (r: any) =>
    isMineNow(r.id) ? 'inuse' : facilityUnderInspection ? 'inspection' : r.status;


  const primaryBtn = { border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '10px', padding: '9px', fontSize: '12px', fontWeight: 700, boxShadow: '0px 6px 14px -6px rgba(47,99,184,.9)' };
  const leaveBtn = { border: 'none', cursor: 'pointer', color: '#E0554E', background: 'transparent', boxShadow: 'inset 0 0 0 1px #F0B6B2', borderRadius: '10px', padding: '8px', fontSize: '12px', fontWeight: 700 };
  const disabledBtn = { border: 'none', cursor: 'default', color: '#A8BCD9', background: '#EDF2FA', borderRadius: '10px', padding: '8px', fontSize: '12px', fontWeight: 700 };

  const filteredMachines = typeFilter === 'all' ? rawMachines : rawMachines.filter((r) => r.type === typeFilter);
  
  const machinesUI = filteredMachines.map((r) => {
    const status = effectiveStatus(r);
    const isInUse = status === 'inuse';
    const isFault = status === 'fault';
    const isInspection = status === 'inspection';

    let badgeFg = '#4A5F82', badgeDot = '#B9C9DF', badgeLabel = t('enum.machineStatus.available');
    if (isFault) { badgeFg = '#E52222'; badgeDot = '#E52222'; badgeLabel = t('enum.machineStatus.fault'); }
    else if (isInspection) { badgeFg = '#70737C'; badgeDot = '#8FAAD0'; badgeLabel = t('enum.machineStatus.inspection'); }
    else if (isInUse) { badgeFg = '#3B76CC'; badgeDot = '#5B93E0'; badgeLabel = t('enum.machineStatus.inUse'); }

    const e = inUseByMachineId.get(r.id);
    const actionOnClick = () => {};
    let actionLabel = null, actionDisabled = false, actionStyle: any = leaveBtn;

    // 05 P3 — 배정된 뒤에는 줄 빠지기 버튼이 없다(기기 목록에서 「이용 중」으로 비활성).
    if (isMineNow(r.id)) {
      actionLabel = t('home.inUse'); actionDisabled = true; actionStyle = disabledBtn;
    }

    let showProgress = false, progressPct = 0;
    if (e) {
      const msLeft = Math.max(0, e.endsAt - serverNow);
      progressPct = msLeft > 0
        ? Math.min(100, Math.max(4, 100 - (msLeft / runMsFor(r.type)) * 100))
        : 100;
      showProgress = true;
    }

    return { ...r, badgeFg, badgeDot, badgeLabel, iconInuse: isInUse, iconAvailable: !isInUse && !isFault && !isInspection, iconFault: isFault, iconInspection: isInspection, showProgress, progress: `${progressPct}%`, actionLabel, actionOnClick, actionDisabled, actionStyle };
  });

  const washerMachines = machinesUI.filter((m) => m.type === 'washer');
  const dryerMachines = machinesUI.filter((m) => m.type === 'dryer');

  // 요약 영역
  const summarize = (type: 'washer'|'dryer', label: string, color: string) => {
    const list = rawMachines.filter((r) => r.type === type);
    const total = list.length;
    const available = list.filter((r) => effectiveStatus(r) === 'available').length;
    const inuse = list.filter((r) => effectiveStatus(r) === 'inuse').length;
    const entry = mine[type];
    const assignedMachine = list.find((r) => assignedByMachineId.has(r.id) || inUseByMachineId.has(r.id));
    const isWaiting = entry?.status === 'waiting';
    const hasFreeSlot = list.length > 0;
    // 05 P2 — 대기 인원은 서버(queueCounts)가 센다. 화면이 규칙을 다시 적지 않는다.
    // 내가 그 줄에 서 있으면 서버가 이미 나를 포함해 세고 있으므로 더하지 않는다.
    const waitingCount = queueCounts[type] || 0;

    let actionLabel, actionOnClick, actionDisabled = false, actionStyle, actionInfo;
    if (assignedMachine) {
      actionLabel = null; actionOnClick = () => {}; actionStyle = primaryBtn; actionInfo = t('home.usingMachine', { machine: assignedMachine.name });
    } else if (isWaiting) {
      actionLabel = null; actionOnClick = () => {}; actionStyle = disabledBtn; actionInfo = t('home.waitingNow', { count: waitingCount });
    } else if (!hasFreeSlot) {
      actionLabel = t('home.justAMoment'); actionOnClick = () => {}; actionDisabled = true; actionStyle = disabledBtn; actionInfo = t('home.canRetrySoon');
    } else if (facilityUnderInspection) {
      // 05 P20 · 06 「세탁실」 · F33 — 이미 배정 · 대기 중인 위 분기는 그대로 두고,
      // 새로 줄서기를 시작하려는 경우에만 막는다. 서버(POST /api/queue/[type])가
      // 최종 방어선이고, 이 버튼은 안내일 뿐이다.
      actionLabel = t('enum.machineStatus.inspection'); actionOnClick = () => {}; actionDisabled = true; actionStyle = disabledBtn; actionInfo = t('home.facilityDisabled');
    } else {
      actionLabel = t('home.joinQueue'); actionOnClick = () => autoJoin(type, label); actionStyle = primaryBtn; actionInfo = available > 0 ? t('home.assignNow') : t('home.waitingNow', { count: waitingCount });
    }

    return { label, total, available, inuse, availablePct: `${(available / total) * 100}%`, inusePct: `${(inuse / total) * 100}%`, availableColor: '#DCE6F3', inuseColor: color, actionLabel, actionOnClick, actionDisabled, actionStyle, actionInfo };
  };

  const typeSummaries = [
    summarize('washer', t('enum.machineKind.washer'), '#5B93E0'),
    summarize('dryer', t('enum.machineKind.dryer'), '#F0913F'),
  ];

  // 내 대기 현황 — 서버가 준 「대기 중」만 그린다 (05 P2).
  // 예상 대기 기준 시각(estimatedTurnAt)은 「가장 먼저 **비는** 기기의 시각」이다 —
  // 타이머 종료(ends_at)가 아니라 거기에 수거 유예 3분을 더한 값이고, 판정·덧셈은
  // 전부 서버가 한다(queries.ts::kindWaitEstimates · 05 P2 + P5 · Issue #85).
  // 빈 기기도 돌아가는 기기도 없으면 서버가 null 을 주므로 카운트다운을 그리지 않는다.
  const myWaiting = (['washer', 'dryer'] as const)
    .filter((type) => mine[type]?.status === 'waiting')
    .map((type) => {
      const entry = mine[type] as ApiQueueEntry;
      const turnAt = entry.estimatedTurnAt ? new Date(entry.estimatedTurnAt).getTime() : null;
      return {
        isWasher: type === 'washer',
        isDryer: type === 'dryer',
        name: t('home.queueOf', {
          kind: type === 'washer' ? t('enum.machineKind.washer') : t('enum.machineKind.dryer'),
        }),
        waitLeft: turnAt === null ? null : fmt(Math.max(0, turnAt - serverNow)),
        ahead: entry.ahead,
        leave: () =>
          leaveType(type, type === 'washer' ? t('enum.machineKind.washer') : t('enum.machineKind.dryer')),
      };
    });

  const myCurrent: any[] = [];
  rawMachines.forEach((r) => {
    const icon = { isWasher: r.type === 'washer', isDryer: r.type === 'dryer' };

    // 배정(F6) — 마감 시각은 **서버가 준 값**이고, 남은 시간은 0 에서 멈춘다.
    // 10분이 지났을 때의 배정 해제 · 경고는 서버가 판정한다 (05 P3 · Issue #8) —
    // 화면이 스스로 지우지 않으므로, 서버가 해제할 때까지 0:00 으로 남아 있는다.
    const assigned = assignedByMachineId.get(r.id);
    if (assigned && !inUseByMachineId.has(r.id)) {
      myCurrent.push({ ...icon, name: r.name, timeLeft: assigned.deadline === null ? '--:--' : fmt(assigned.deadline - serverNow), timeColor: '#5B93E0', message: t('home.qrHint'), msgColor: '#8FAAD0', btnLabel: t('home.qrVerify'), btnStyle: { ...primaryBtn, width: '100%' }, onClick: () => setWarningId(r.id) });
      return;
    }

    // F9 · F10 — 사용중 · 수거대기는 서버가 준 종료 예정 시각(endsAt)만으로 그린다.
    // 실제 종료 처리 · 3분 초과 강제 종료 · 경고는 서버 몫이다(Issue #7 · #8).
    const e = inUseByMachineId.get(r.id);
    if (!e) return;
    const msLeft = e.endsAt - serverNow;
    if (msLeft > 0) {
      myCurrent.push({ ...icon, name: r.name, timeLeft: t('home.aboutTime', { time: fmt(msLeft) }), timeColor: '#5B93E0', message: t('home.doneHint'), msgColor: '#8FAAD0', btnLabel: t('home.done'), btnStyle: { ...leaveBtn, width: '100%' }, onClick: () => finish(r.id, r.name) });
    } else {
      const graceDeadline = e.endsAt + GRACE_MS;
      myCurrent.push({ ...icon, name: r.name, timeLeft: fmt(graceDeadline - serverNow), timeColor: '#E0554E', message: t('home.overtimeHint'), msgColor: '#E0554E', btnLabel: t('home.done'), btnStyle: { ...leaveBtn, width: '100%' }, onClick: () => finish(r.id, r.name) });
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
      `}</style>

      <div className="app-frame" style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden' }}>

        {/*
          05 P26 — 로그인 뒤 홈 첫 진입에서 폰 알림 허용을 한 번만 묻는다.
          이미 물어봤거나 브라우저가 허용 · 거절을 기억하고 있으면 아무것도 그리지
          않으므로 기존 레이아웃에는 영향이 없다(자기 자리에 떠 있는 카드다).
        */}
        <NotificationPrompt />
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '100%', height: '96px', position: 'relative' }}>
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
          <Link href="/notifications" style={{ display: 'flex', width: '25px', height: '25px', borderRadius: '8px', position: 'absolute', right: '30px', top: '60px', background: `url(${hasUnread ? '/icons/bell-active.svg' : '/icons/bell.svg'}) center / cover no-repeat` }}></Link>
        </div>

        {/* 메인 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: '1 1 0', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overflowX: 'hidden' }}>
          <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '23px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3557', marginTop: '-5px' }}>{myName ? t('home.greeting', { name: myName }) : t('home.greetingNoName')}</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#8FAAD0' }}>{t('home.subtitle')}</p>
            </div>

            {/* 아무것도 안 할 때 */}
            {fullyIdle && (
              <div style={{ background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', height: '48px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#8FAAD0' }}>{t('home.nothingInUse')}</span>
              </div>
            )}

            {/* 대기 및 사용 중인 내역 */}
            {!fullyIdle && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
                {/* 내 대기 현황 */}
                <div style={{ background: '#fff', borderRadius: '20px', padding: '14px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, alignSelf: 'stretch' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#5B93E0' }}>{t('home.myQueueTitle')}</span>
                  {myWaiting.length === 0 && <span style={{ fontSize: '12px', color: '#8FAAD0' }}>{t('home.noWaiting')}</span>}
                  {myWaiting.map((mq, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        <img src={mq.isWasher ? "/icons/washer-inuse.svg" : "/icons/dryer-inuse.svg"} alt="" style={{ width: '30px', height: '30px', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mq.name}</span>
                          {/* 05 P2 · P5 — 예상 대기는 서버가 준 「가장 먼저 비는 기기까지 남은 시간」
                              (타이머 종료 + 수거 유예)이다. 빈 기기도 돌아가는 기기도 없으면 언제
                              빌지 알 수 없으므로 시간을 지어내지 않는다. */}
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#5B93E0' }}>
                            {mq.waitLeft === null
                              ? (mq.ahead > 0 ? t('home.aheadCount', { count: mq.ahead }) : t('home.waitingTurn'))
                              : t('home.assignInAbout', { time: mq.waitLeft ?? '' })}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#8FAAD0', lineHeight: 1.4, marginTop: '9px', marginBottom: '8px' }}>{t('home.leaveHint')}</span>
                      <button onClick={mq.leave} style={leaveBtn}>{t('home.leaveQueue')}</button>
                    </div>
                  ))}
                </div>

                {/* 현재 상태 */}
                <div style={{ background: '#fff', borderRadius: '20px', padding: '14px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, alignSelf: 'stretch' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: myCurrent.some(c => c.timeColor === '#E0554E') ? '#E0554E' : '#5B93E0' }}>{t('home.currentStatus')}</span>
                  {myCurrent.map((cu, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={cu.isWasher ? "/icons/washer-inuse.svg" : "/icons/dryer-inuse.svg"} alt="" style={{ width: '30px', height: '30px', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cu.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: cu.timeColor }}>{t('home.timeLeft', { time: cu.timeLeft })}</span>
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
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3557' }}>{t('home.liveStatus')}</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#8FAAD0' }}>{t('home.liveStatusSub')}</p>
            </div>
            
            {loading ? (
              <div style={{ background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px' }}>
                <span style={{ fontSize: '13px', color: '#8FAAD0' }}>{t('home.loadingMachines')}</span>
              </div>
            ) : loadError ? (
              <div style={{ background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E3557' }}>{t('home.loadFailed')}</span>
                <span style={{ fontSize: '12px', color: '#8FAAD0' }}>{t('home.loadFailedHint')}</span>
                <button onClick={loadMachines} style={{ ...primaryBtn, padding: '9px 18px' }}>{t('common.retry')}</button>
              </div>
            ) : (
              <>
            {facilityUnderInspection && (
              <div style={{ background: '#FFF6E9', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#8A5300' }}>{t('home.facilityTitle')}</span>
                <span style={{ fontSize: '12px', color: '#8A5300' }}>{t('home.facilityBody')}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
              {typeSummaries.map((ts, idx) => (
                <div key={idx} style={{ background: '#fff', borderRadius: '18px', padding: '14px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{ts.label}</span>
                    <span style={{ fontSize: '11px', color: '#8FAAD0' }}>{t('home.totalCount', { count: ts.total })}</span>
                  </div>
                  <div style={{ display: 'flex', height: '7px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ background: ts.inuseColor, width: ts.inusePct }}></div>
                    <div style={{ background: ts.availableColor, width: ts.availablePct }}></div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#8FAAD0', flexWrap: 'wrap' }}>
                    <span><span style={{ color: ts.inuseColor, fontWeight: 700 }}>{ts.inuse}</span> {t('home.inUseCount')}</span>
                    <span><span style={{ color: ts.availableColor, fontWeight: 700 }}>{ts.available}</span> {t('home.availableCount')}</span>
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
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{t('home.machineList')}</div>
                <div style={{ display: 'flex', gap: '4px', background: '#E4EDFA', borderRadius: '12px', padding: '3px' }}>
                  {[{ key: 'all', label: t('home.filterAll') }, { key: 'washer', label: t('enum.machineKind.washer') }, { key: 'dryer', label: t('enum.machineKind.dryer') }].map((f) => (
                    <div key={f.key} onClick={() => setTypeFilter(f.key)} style={{ cursor: 'pointer', padding: '5px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap', background: typeFilter === f.key ? '#fff' : 'transparent', color: typeFilter === f.key ? '#1E3557' : '#8FAAD0' }}>{f.label}</div>
                  ))}
                </div>
              </div>

              {/* 세탁기 리스트 */}
              {washerMachines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#8FAAD0' }}>{t('enum.machineKind.washer')}</span>
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
                        {m.iconInspection && (
                          <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
                            <img src="/icons/washer-inuse.svg" alt="" style={{ width: '24px', height: '24px', filter: 'grayscale(1) opacity(.55)' }} />
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: '#8FAAD0', color: '#fff', fontSize: '9px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>II</div>
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
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#8FAAD0' }}>{t('enum.machineKind.dryer')}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '8px' }}>
                    {dryerMachines.map((m, idx) => (
                      <div key={idx} style={{ background: '#fff', borderRadius: '14px', padding: '10px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        {m.iconAvailable && <img src="/icons/dryer-available.svg" alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />}
                        {m.iconInuse && <img src="/icons/dryer-inuse.svg" alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />}
                        {m.iconFault && (
                          <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
                            <img src="/icons/dryer-inuse.svg" alt="" style={{ width: '24px', height: '24px', filter: 'grayscale(1) opacity(.55)' }} />
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: '#E52222', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>!</div>
                          </div>
                        )}
                        {m.iconInspection && (
                          <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
                            <img src="/icons/dryer-inuse.svg" alt="" style={{ width: '24px', height: '24px', filter: 'grayscale(1) opacity(.55)' }} />
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: '#8FAAD0', color: '#fff', fontSize: '9px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>II</div>
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
            </div>
              </>
            )}

          </div>
        </div>

        {/* 하단 탭 바 */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '8px 0', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(112,115,124,.12)', height: '60px' }}>
          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center' }}>
            <Link href="/home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px', background: 'rgba(0,102,255,.08)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0066FF' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#0066FF' }}>{t('nav.home')}</span>
            </Link>
            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>{t('nav.history')}</span>
            </Link>
            <Link href="/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>{t('nav.settings')}</span>
            </Link>
          </div>
        </div>

        {/* 모달 1: QR 안내 경고창 */}
        {warningId && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(20,42,84,.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '300px', background: '#fff', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,42,84,.55)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{t('home.qrModalTitle')}</span>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t('home.qrModalBody')}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setWarningId(null)} style={{ border: 'none', cursor: 'pointer', color: '#1E3557', background: 'transparent', boxShadow: 'inset 0 0 0 1px #E3EBF7', borderRadius: '12px', padding: '9px 16px', fontSize: '13px', fontWeight: 700 }}>{t('common.cancel')}</button>
                <button onClick={() => { setScanningId(warningId); setWarningId(null); }} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 700 }}>{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        )}

        {/* 모달 2: QR 스캐너 — 실제 카메라(qr-scanner.tsx). 최종 판정은 서버가 한다. */}
        {scanningId && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(13,28,58,.74)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <QrScanner onClose={() => setScanningId(null)} onVerified={handleQrVerified} />
          </div>
        )}

        {/* 모달 3: 인증 시간 초과 */}
        {expiredOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(20,42,84,.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '300px', background: '#fff', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0px 20px 40px -12px rgba(20,42,84,.55)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{t('home.expiredTitle')}</span>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>{t('home.expiredBody')}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setExpiredOpen(false)} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 700 }}>{t('common.confirm')}</button>
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