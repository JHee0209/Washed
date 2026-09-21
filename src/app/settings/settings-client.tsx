'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useUnreadCount } from '@/lib/use-unread-count';
import ProfileAvatar from '@/components/profile-avatar';
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  permissionServerSnapshot,
  permissionSnapshot,
  refreshPushPermission,
  subscribePushState,
  subscribePushSubscriptionChange,
} from '@/lib/push-client';
import { useRouter } from 'next/navigation';
import {
  ALLOWED_EVIDENCE_MIME,
  MACHINE_COUNT,
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_LABEL,
  REASON_LABELS,
  isAllowedEvidenceMime,
  isMachineKind,
} from '@/lib/report-rules';
import { requestWithdrawal } from '@/lib/user-actions';

// FAQ 데이터
const FAQ_KO = [
  { title: '줄서기 · 배정', items: [
    { id: 'q1', question: '배정은 어떻게 정해지나요?', answer: '· 줄을 선 순서대로 자동 배정됩니다.\n  앞사람이 줄을 빠지거나 사용을 끝내면 순서가 당겨져요.\n· 같은 종류의 기기 중 가장 먼저 비는 기기에 배정되기 때문에\n  특정 호기를 지정할 수는 없습니다.\n· 내 차례가 오기 10분 전에 미리 알림을 보내드립니다.' },
    { id: 'q2', question: '여러 대에 동시에 줄 설 수 있나요?', answer: '· 세탁기와 건조기에 각각 한 번씩, 최대 두 줄까지 설 수 있습니다.\n· 세탁 후 건조까지 하실 계획이라면, 건조기 줄에도 미리 함께 서두는 편이 좋습니다.' },
    { id: 'q3', question: '줄을 뺐다가 다시 설 수 있나요?', answer: '· 가능합니다.\n  다만, 다시 설 때는 맨 뒤에서 시작합니다.\n· 이미 배정된 상태에서 줄을 빼면 그 기기는 바로 다음 사람에게 넘어갑니다.' },
  ]},
  { title: '이용 중', items: [
    { id: 'q4', question: '세탁기에 이전 사용자의 세탁물이 남아 있어요', answer: '· 설정 > 신고하기 > 해당 사유를 선택해 접수해 주세요.\n· 확인되면 이전 사용자에게 경고가 부여되고, 경고가 3회가\n  쌓이면 3일 동안 줄서기가 제한됩니다.\n· 이전 사용자는 분실이나 훼손 문제로 이어질 수 있으니,\n  주의 부탁드립니다.' },
    { id: 'q5', question: '세탁이 일찍 끝났어요', answer: '· 홈 화면에서 "다했어요"를 눌러주세요.\n  남은 시간과 관계없이 이용이 종료되고 다음 사람에게 바로 배정됩니다.\n· 모든 사용자들은 세탁이 끝남과 동시에 항상 "다했어요" 버튼을 눌러주세요.' },
    { id: 'q6', question: 'QR이 인식되지 않아요', answer: '· 기기 문에 붙은 QR을 화면 가운데에 맞추고, 손 그림자가 지지 않게 해주세요.\n· 코드가 찢어졌거나 오염되어 인식되지 않으면 설정 화면의\n  신고하기에서 "기기가 고장났어요"로 접수해 주세요.\n· 배정 후 10분이 지나기 전에 접수하면 경고가 부여되지 않습니다.' },
  ]},
  { title: '경고', items: [
    { id: 'q7', question: '경고는 언제 받나요?', answer: '네 가지 경우에 부여됩니다.\n· 배정 후 10분 안에 사용을 시작하지 않은 경우\n· 다했어요 버튼을 클릭하지 않은 경우\n· 타이머 종료 후 3분의 세탁 수거 시간이 지났는데도\n  세탁물을 수거해 가지 않았을 경우\n· 내 차례가 아닌데 기기를 사용해 다른 사용자의 신고가 확인 된 경우\n\n경고가 3회 쌓이면 3일 동안 줄서기가 제한됩니다.\n단, \'다했어요\' 버튼 미클릭과 \'세탁물 미수거\'는 함께 발생하더라도 중복 적용되지 않고 통합 1회의 경고만 부여됩니다.' },
    { id: 'q8', question: '경고는 사라지나요?', answer: '· 매달 1일에 0회로 초기화됩니다.\n  다만, 이미 시작된 3일 이용 제한은 초기화와 관계없이 기간을 모두 채워야 해제됩니다.\n· 경고 내역은 기록 화면에서 언제든 확인할 수 있습니다.' },
  ]},
  { title: '계정 · 알림', items: [
    { id: 'q9', question: '알림이 오지 않아요', answer: '· 먼저 휴대폰 설정에서 Washed의 알림 권한이 켜져 있는지 확인해 주세요.\n· 권한이 켜져 있다면 앱의 설정 > 알림이 켜져 있는지 확인해 주세요.\n· 방해 금지 모드나 절전 모드가 켜져 있으면 알림이 늦게 도착할 수 있습니다.' },
  ]},
];

type SettingsClientProps = {
  name: string;
  studentId: string;
};

export default function SettingsClient({ name, studentId }: SettingsClientProps) {
  const router = useRouter();

  // --- 상태 관리 ---
  // 종의 점은 DB 가 센다 (F18). 예전에는 알림함이 localStorage 에 적어 둔
  // washed_unread 를 읽었는데, 알림함을 열어 보기 전에는 값이 없었다.
  const unreadCount = useUnreadCount();
  const hasUnread = unreadCount > 0;

  const [reportReason, setReportReason] = useState<string | null>(null);
  const [etcText, setEtcText] = useState('');
  const [laundryType, setLaundryType] = useState<string | null>(null);
  const [laundryMachine, setLaundryMachine] = useState<number | null>(null);

  // 증거 사진 (05 P15 — 「세탁물이 있어요」 전용 · 필수).
  // 파일 자체는 여기 들고 있다가 접수할 때 FormData 로 한 번에 올린다 —
  // 따로 먼저 올리면 접수가 실패했을 때 주인 없는 파일이 남는다.
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  // 접수 중에는 버튼을 잠근다 — 연속으로 누르면 신고가 여러 건 만들어진다.
  const [submitting, setSubmitting] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // 언어 설정 관련 상태
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('ko');

  const langMap: Record<string, { label: string, icon: string }> = {
    ko: { label: '한국어', icon: '/icons/flag-kr.png' },
    en: { label: 'English', icon: '/icons/flag-en.png' },
    zh: { label: '中文', icon: '/icons/flag-zh.png' },
    // ⭐️ 일본 국기 이미지가 폴더에 없어서 웹 주소(CDN)로 대체했습니다!
    ja: { label: '日本語', icon: 'https://flagcdn.com/w40/jp.png' }
  };

  // 05 P26 — 폰 알림 허용(Notification.permission)은 브라우저가 쥔 **운영체제
  // 단위** 값이라 코드로 되돌릴 수 없다. denied 안내 문구에만 쓰고, ON/OFF
  // 표시 자체는 permission 이 아니라 **실제 PushSubscription 존재 여부**로
  // 판정한다(Issue #68) — 권한이 granted 여도 Washed 구독은 꺼져 있을 수 있다.
  const pushPermission = useSyncExternalStore(
    subscribePushState,
    permissionSnapshot,
    permissionServerSnapshot,
  );
  const [pushOn, setPushOn] = useState(false);
  const [pushChecked, setPushChecked] = useState(false);
  const [pushPending, setPushPending] = useState(false);

  // 켜고 끄는 중인지 — pushPending 과 같은 뜻이지만 **렌더를 기다리지 않는다**.
  // state 는 다음 렌더에야 반영돼서 같은 tick 안에 두 번 들어온 클릭을 놓칠 수
  // 있다. 실제 중복 요청(POST · DELETE)을 막는 자리는 이 ref 하나다.
  const pushBusyRef = useRef(false);

  // 조회 응답은 **보낸 순서대로 오지 않는다.** mount · focus 의 재조회가 늦게
  // 도착해 방금 켠 결과를 도로 덮는 일을 막는다 — 가장 마지막에 보낸 조회의
  // 답만 화면에 반영한다.
  //
  // 여기에 "아직 살아 있는지" 가드를 두지 않는 것은 의도적이다. React 18+ 에서
  // unmount 뒤 setState 는 경고 없는 no-op 이라 막을 것이 없고, 그 가드는 정작
  // 성공한 갱신을 조용히 삼킨다(Issue #75 에서 실제로 그렇게 깨졌다).
  const pushSyncSeqRef = useRef(0);

  // 실제 브라우저 구독을 다시 읽어 화면을 맞춘다 — 낙관적 갱신을 하지 않는 자리.
  // ON/OFF 의 기준은 언제나 permission 이 아니라 이 결과다(Issue #68 · #75).
  const syncPushToggle = useCallback(async () => {
    const seq = ++pushSyncSeqRef.current;
    const subscription = await getCurrentSubscription();
    // 내가 보낸 뒤에 더 새 조회가 나갔으면 이 답은 이미 낡았다 — 버린다.
    if (seq === pushSyncSeqRef.current) {
      setPushOn(!!subscription);
      setPushChecked(true);
    }
    return subscription;
  }, []);

  // Issue #75 — 구독이 실제로 생기거나 사라지면 그 순간 **살아 있는** 화면이
  // 다시 읽는다. 켠 쪽(turnOnPush)의 반환값에만 기대면, 비동기 작업 중에 화면이
  // 다시 마운트됐을 때 옛 인스턴스로 간 setState 는 버려지고 새 인스턴스는
  // 자기 mount 조회가 구독 생성보다 **먼저** 끝났을 경우 옛 값에 그대로 남는다.
  // 이 신호는 그때 살아 있는 인스턴스에게 가므로 그 구멍이 막힌다.
  useEffect(
    () => subscribePushSubscriptionChange(() => {
      void syncPushToggle();
    }),
    [syncPushToggle],
  );

  // 새로고침·첫 진입 시 실제 구독을 다시 확인한다 — permission 만 보고 켜진
  // 것처럼 그리면 안 된다. 확인이 끝나기 전에는 "확인 중…" 으로만 보여준다.
  //
  // Issue #75 — 사용자가 사이트 설정에서 알림 권한을 바꾸고 탭으로 돌아오는 길이
  // 실제로 있는데, 브라우저는 그 변경을 알려주지 않는다. 화면이 다시 보일 때마다
  // permission 스냅샷과 구독을 **함께** 다시 읽어 stale 표시를 없앤다.
  // 강제 새로고침은 하지 않는다 — 값이 그대로면 useSyncExternalStore 도
  // setState 도 같은 값이라 렌더를 건너뛰므로 반복 refresh 가 생기지 않는다.
  useEffect(() => {
    // 이 실행에만 속한 플래그다 — ref 와 달리 다시 마운트되면 새로 만들어지므로,
    // 옛 실행의 정리가 새 실행을 막는 일이 생기지 않는다.
    let cancelled = false;

    const resync = () => {
      // 켜고 끄는 중에는 비켜선다 — 끝난 뒤 그쪽 finally 가 실제 상태로 맞춘다.
      if (pushBusyRef.current) return;
      refreshPushPermission();
      void syncPushToggle();
    };

    resync();

    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };

    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', onVisible);

    // Permissions API 는 브라우저마다 지원이 갈린다 — 있으면 권한 변경을 바로
    // 받고, 없어도 위 focus · visibilitychange 로 잡힌다
    // (components/notification-prompt.tsx 와 같은 방식을 그대로 쓴다).
    let status: PermissionStatus | undefined;
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        result.addEventListener('change', resync);
      })
      .catch(() => {
        // 이 브라우저는 알림 권한을 Permissions API 로 못 읽는다 — 무시한다
      });

    return () => {
      cancelled = true;
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', onVisible);
      status?.removeEventListener('change', resync);
    };
  }, [syncPushToggle]);

  const turnOnPush = async () => {
    if (pushBusyRef.current) return;

    // Issue #75 — denied 는 코드로 되돌릴 수 없다(05 P26). 권한 창을 다시
    // 부르지 않고(불러도 뜨지 않는다) 사이트 설정에서 직접 켜도록 안내만 한다.
    // 서비스 워커 등록도 구독 요청도 하지 않으므로 UI 는 OFF 그대로 남는다.
    if (permissionSnapshot() === 'denied') {
      showToast('브라우저 설정에서 알림 권한을 허용해 주세요.');
      return;
    }

    pushBusyRef.current = true;
    setPushPending(true);
    try {
      // enablePush 는 permission 에 따라 갈린다 — default 면 브라우저의 **실제**
      // 권한 창을 띄우고, granted 면 권한을 다시 묻지 않고 구독만 새로 만든다
      // (OFF → ON 재활성화). 서버에 구독을 저장하지 못하면 던진다 — 권한만
      // 켜지고 알림은 오지 않는 상태를 성공이라고 말하지 않기 위해서다.
      const result = await enablePush();
      // 실제 구독 존재 여부로 다시 확인한 뒤에만 ON 으로 바꾼다(낙관적 갱신 금지).
      const subscription = await syncPushToggle();
      if (subscription) showToast('알림을 켰어요.');
      else if (result === 'denied') showToast('브라우저 설정에서 알림 권한을 허용해 주세요.');
      else showToast('알림을 켜지 못했어요. 잠시 뒤 다시 시도해주세요.');
    } catch {
      // 브라우저 구독까지는 만들어졌는데 서버 저장만 실패했을 수 있다. 화면은
      // 어떤 경우에도 실제 구독 기준으로 맞춘다 — 여기서만 OFF 로 남겨 두면
      // 다음 focus 재조회 때 갑자기 ON 으로 바뀌어 더 어긋난다.
      await syncPushToggle();
      showToast('알림을 켜지 못했어요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPushPending(false);
      pushBusyRef.current = false;
    }
  };

  const turnOffPush = async () => {
    if (pushBusyRef.current) return;
    pushBusyRef.current = true;
    setPushPending(true);
    try {
      await disablePush();
    } finally {
      // disablePush() 는 항상 실제 상태 기준으로 다시 확인하게 한다(낙관적
      // 갱신 금지) — 브라우저 unsubscribe 가 실패했으면 그대로 ON 으로 남는다.
      const subscription = await syncPushToggle();
      showToast(subscription ? '알림을 끄지 못했어요. 다시 시도해주세요.' : '알림을 껐어요.');
      setPushPending(false);
      pushBusyRef.current = false;
    }
  };

  // 미리보기용 blob: URL 은 명시적으로 풀어 줘야 한다 — 화면을 떠날 때
  // 남아 있으면 그 사진이 탭이 닫힐 때까지 메모리에 붙어 있는다.
  useEffect(() => {
    return () => {
      if (evidencePreview) URL.revokeObjectURL(evidencePreview);
    };
  }, [evidencePreview]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  // --- 신고하기 로직 (F11 · 05 P15) ---
  //
  // 사유 목록 · 기기 대수 · 사진 조건은 전부 src/lib/report-rules.ts 에서 온다.
  // 서버(/api/reports)가 보는 것과 **같은 값**이어야 하기 때문이다 (08 · 7번).
  const reasonDefs = REASON_LABELS;
  const showLaundryFilter = reportReason !== null && reportReason !== '기타';
  const showEvidenceSlot = reportReason === '세탁물이 있어요';
  const showMachineNumbers = showLaundryFilter && !!laundryType;
  const machineCount = isMachineKind(laundryType) ? MACHINE_COUNT[laundryType] : 0;

  // 05 P15 — 「"세탁물이 있어요" 는 사진을 붙이기 전까지 접수 버튼이 켜지지 않는다」
  const canSubmit =
    !!reportReason &&
    (!showLaundryFilter || (!!laundryType && !!laundryMachine)) &&
    (!showEvidenceSlot || !!evidenceFile) &&
    (reportReason !== '기타' || !!etcText.trim());

  const clearEvidence = () => {
    setEvidenceFile(null);
    setEvidencePreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    if (evidenceInputRef.current) evidenceInputRef.current.value = '';
  };

  /** 사유를 바꾸면 그 사유에 없는 칸은 전부 비운다 (05 P15) */
  const pickReason = (label: string) => {
    setReportReason(label);
    setEtcText(label === '기타' ? etcText : '');
    setLaundryType(null);
    setLaundryMachine(null);
    if (label !== '세탁물이 있어요') clearEvidence();
  };

  const pickEvidence = (file: File | null) => {
    if (!file) return clearEvidence();

    // 화면에서도 서버와 **같은 상수**로 먼저 걸러 준다. 이것은 친절이고,
    // 접수를 정하는 것은 서버다 — 아래 검사를 지워도 서버가 415 · 413 으로 막는다.
    if (!isAllowedEvidenceMime(file.type)) {
      showToast('JPG · PNG · WebP 이미지만 첨부할 수 있어요.');
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      showToast(`사진은 ${MAX_EVIDENCE_LABEL} 까지 첨부할 수 있어요.`);
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
      return;
    }

    setEvidenceFile(file);
    setEvidencePreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };

  const submitReport = async () => {
    // 접수 중 재진입을 막는다 — 버튼도 잠그지만 한 번 더 본다.
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      // 신고자는 보내지 않는다. 서버가 세션에서 정한다 (08 · 1번).
      const form = new FormData();
      form.set('reason', reportReason!);
      if (laundryType) form.set('machineKind', laundryType);
      if (laundryMachine) form.set('machineNo', String(laundryMachine));
      if (etcText.trim()) form.set('etcContent', etcText.trim());
      if (evidenceFile) form.set('evidence', evidenceFile);

      const response = await fetch('/api/reports', { method: 'POST', body: form });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        if (response.status === 401) {
          showToast('로그인이 필요해요.');
          setTimeout(() => router.push('/login'), 800);
          return;
        }
        showToast(data?.message ?? '신고를 접수하지 못했어요. 잠시 뒤 다시 시도해주세요.');
        return;
      }

      setReportReason(null);
      setEtcText('');
      setLaundryType(null);
      setLaundryMachine(null);
      clearEvidence();
      showToast('신고가 접수됐어요. 관리자가 확인 후 조치할게요.');
    } catch {
      showToast('신고를 접수하지 못했어요. 연결을 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // Issue #29 — 실제 Auth.js 세션을 제거한다. redirect 기본값(true)이 서버가
  // 세션 쿠키를 지운 응답을 받은 뒤 전체 리로드로 이동시키므로, 화면이
  // 스스로 라우팅하지 않는다(next-auth/react의 signOut, redirectTo가 현재
  // 설치 버전의 API — callbackUrl은 deprecated).
  const handleLogout = () => {
    void signOut({ redirectTo: '/login' });
  };

  /**
   * 탈퇴 신청 (05 P24).
   *
   * 즉시 삭제가 아니라 **14일 유예**다 — 서버는 신청 시각만 적고, 실제 삭제는
   * 14일 뒤 정리 배치가 한다. 그때 이 사람이 올린 증거 사진도 함께 지워진다
   * (05 P23 · src/lib/cleanup.ts). 아래 모달 문구가 말하는 그대로다.
   *
   * requestWithdrawal() 이 끝에서 signOut({ redirectTo: '/login' }) 을 부르므로
   * 여기서 따로 화면을 옮기지 않는다.
   */
  const handleWithdraw = async () => {
    if (withdrawPending) return;
    setWithdrawPending(true);
    try {
      await requestWithdrawal();
    } catch {
      setWithdrawPending(false);
      setWithdrawOpen(false);
      showToast('탈퇴 신청을 처리하지 못했어요. 잠시 뒤 다시 시도해주세요.');
    }
  };

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
        .group { background: #fff; border-radius: 14px; border: 1px solid #E6EDF7; overflow: hidden; }
        .ghead { font-size: 12.5px; font-weight: 600; color: #8FAAD0; margin: 0 0 7px 16px; letter-spacing: .1px; }
        .cell { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 10px 16px; position: relative; }
        .cell + .cell::before { content: ""; position: absolute; left: 16px; right: 0; top: 0; height: 1px; background: #EDF2F9; }
        .ctitle { font-size: 14.5px; font-weight: 500; color: #1E3557; flex: 1; min-width: 0; }
        .cdesc { margin-top: 2px; font-size: 12px; color: #9AAFCC; }
        .cval { font-size: 14px; color: #9AAFCC; flex-shrink: 0; }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px', position: 'relative' }}>
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
          <Link href="/notifications" style={{ boxSizing: 'border-box', width: '25px', height: '25px', borderRadius: '8px', position: 'absolute', right: '30px', top: '60px', background: `url(${hasUnread ? '/icons/bell-active.svg' : '/icons/bell.svg'}) center / cover no-repeat` }}></Link>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '18px 16px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

            <h1 style={{ margin: 0, fontSize: '25px', fontWeight: 800, letterSpacing: '-0.8px', marginLeft: '5px', marginBottom: '-10px' }}>설정</h1>

            {/* 프로필 섹션 */}
            <div className="group" style={{ background: '#EDF1F7', borderColor: '#E1E8F2' }}>
              <Link href="/profile" className="cell" style={{ padding: '16px', gap: '14px' }}>
                <ProfileAvatar size={56} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>{name}</span>
                  <span style={{ fontSize: '13px', color: '#7C8CA6' }}>{studentId}</span>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}><path d="M1.2 1.2 6.6 7l-5.4 5.8" stroke="#B4C2D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </Link>
            </div>

            {/* 알림 설정 */}
            <div>
              <div className="ghead">알림</div>

              {/*
                Issue #68 — 세부 토글("차례 10분 전 알림" · "이용 가능 알림")을
                걷어내고, 실제 PushSubscription 존재 여부를 기준으로 한 단일
                ON/OFF 로 단순화했다(05 P26). 브라우저 권한(permission) 자체는
                코드로 끌 수 없지만, Washed 구독은 여기서 실제로 켜고 끈다
                (enablePush · disablePush) — ON 판정은 permission 이 아니라
                getCurrentSubscription() 의 실제 결과를 따른다.
              */}
              <div className="group">
                <div className="cell">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ctitle">
                      {!pushChecked
                        ? '알림 상태 확인 중…'
                        : pushPermission === 'unsupported'
                          ? '이 브라우저는 알림을 지원하지 않아요'
                          : pushOn
                            ? '알림이 켜져 있어요'
                            : '알림이 꺼져 있어요'}
                    </div>
                    <div className="cdesc">
                      {!pushChecked
                        ? ''
                        : pushPermission === 'unsupported'
                          ? '이 브라우저는 폰 알림을 지원하지 않아요.'
                          : pushPermission === 'denied'
                            ? '브라우저에서 알림이 차단되어 있습니다. 사이트 설정에서 알림 권한을 허용해주세요.'
                            : pushOn
                              ? '배정 · 종료 · 공지 알림을 폰으로 받을 수 있어요.'
                              : '켜면 앱을 닫아 두어도 차례와 종료를 알려드려요.'}
                    </div>
                  </div>
                  {/*
                    알림 영역은 상태와 무관하게 항상 토글 하나로 보여준다 —
                    unsupported · 확인 중에는 **숨기지 않고 disabled 로만** 막는다.
                    ON/OFF 판단은 이 상태들에서도 permission 이 아니라 실제
                    PushSubscription(pushOn) 기준을 유지한다.

                    Issue #75 — denied 는 disabled 에서 뺀다. 코드로 권한을 되돌릴
                    수 없는 것은 그대로지만(권한 요청을 반복하지 않는다), 눌렀을 때
                    아무 반응도 없으면 어디서 고쳐야 하는지 알 수 없다. 눌리기는
                    하되 turnOnPush 가 권한 창 대신 사이트 설정 안내만 띄우고
                    돌아오므로, 요청도 반복되지 않고 UI 도 OFF 그대로 남는다.
                  */}
                  {(() => {
                    const disabled =
                      !pushChecked ||
                      pushPending ||
                      pushPermission === 'unsupported';
                    // denied 상태는 실제 subscription 이 남아 있더라도 항상 OFF 로
                    // 보여준다(요청하신 고정 규칙) — 브라우저가 이미 알림을 막았으므로
                    // 어차피 전달되지 않는다.
                    const toggleOn = pushPermission === 'denied' ? false : pushOn;
                    return (
                      <div
                        onClick={disabled ? undefined : toggleOn ? turnOffPush : turnOnPush}
                        style={{
                          width: '40px',
                          height: '24px',
                          borderRadius: '999px',
                          background: toggleOn ? '#5B93E0' : '#DFE7F1',
                          position: 'relative',
                          cursor: disabled ? 'default' : 'pointer',
                          flexShrink: 0,
                          opacity: disabled ? 0.6 : 1,
                          transition: 'background .22s ease',
                        }}
                      >
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: toggleOn ? '18px' : '2px', boxShadow: '0 1px 3px rgba(20,42,84,.22)', transition: 'left .22s ease' }}></div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 신고하기 */}
            <div>
              <div className="ghead">신고하기</div>
              <div className="group" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0' }}>어떤 문제가 있었는지 알려주세요.</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reasonDefs.map((label, idx) => {
                    const on = reportReason === label;
                    return (
                      <div key={idx} onClick={() => pickReason(label)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 14px', borderRadius: '12px', cursor: 'pointer', background: on ? 'rgba(91,147,224,.10)' : '#fff', boxShadow: `inset 0 0 0 1px ${on ? '#5B93E0' : '#E6EDF7'}` }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', boxShadow: `inset 0 0 0 ${on ? '6px' : '1.5px'} ${on ? '#5B93E0' : '#C3D2E6'}`, flexShrink: 0 }}></div>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: on ? '#2F63B8' : '#4A5F82' }}>{label}</span>
                      </div>
                    );
                  })}

                  {/* 세탁기/건조기 필터 */}
                  {showLaundryFilter && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '12px', background: '#F7FAFE', boxShadow: 'inset 0 0 0 1px #E6EDF7' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#5A7CA8' }}>기기 종류</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['세탁기', '건조기'].map((t) => {
                          const on = laundryType === t;
                          return (
                            <div key={t} onClick={() => { setLaundryType(t); setLaundryMachine(null); }} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, background: on ? '#4C86D8' : '#fff', color: on ? '#fff' : '#4A5F82', boxShadow: `inset 0 0 0 1px ${on ? '#4C86D8' : '#E6EDF7'}` }}>{t}</div>
                          );
                        })}
                      </div>

                      {showMachineNumbers && (
                        <>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#5A7CA8', marginTop: '4px' }}>호기 선택</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                            {Array.from({ length: machineCount }, (_, i) => i + 1).map((n) => {
                              const on = laundryMachine === n;
                              return (
                                <div key={n} onClick={() => setLaundryMachine(n)} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: on ? '#4C86D8' : '#fff', color: on ? '#fff' : '#4A5F82', boxShadow: `inset 0 0 0 1px ${on ? '#4C86D8' : '#E6EDF7'}` }}>{n}호기</div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 기타 텍스트 입력 */}
                  {reportReason === '기타' && (
                    <textarea placeholder="의견을 입력해주세요" value={etcText} onChange={(e) => setEtcText(e.target.value)} style={{ border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', background: '#F7FAFE', padding: '12px', fontSize: '13.5px', color: '#1E3557', resize: 'none', minHeight: '64px', fontFamily: 'inherit' }}></textarea>
                  )}

                  {/*
                    증거 사진 (05 P15 — 「세탁물이 있어요」 에만 있고 **필수**).
                    남의 세탁물을 꺼내는 근거가 되므로 붙이기 전까지 접수 버튼이
                    켜지지 않는다. 같은 조건을 서버도 본다 (08 · 7번).
                  */}
                  {showEvidenceSlot && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#5A7CA8' }}>증거 사진 (필수)</span>
                      <input
                        ref={evidenceInputRef}
                        type="file"
                        accept={ALLOWED_EVIDENCE_MIME.join(',')}
                        onChange={(e) => pickEvidence(e.target.files?.[0] ?? null)}
                        style={{ display: 'none' }}
                      />
                      {evidencePreview ? (
                        <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E6EDF7' }}>
                          {/* next/image 는 blob: URL 을 최적화하지 못한다 — 미리보기는 <img> 로 둔다 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={evidencePreview} alt="첨부한 증거 사진" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <button
                            type="button"
                            onClick={clearEvidence}
                            disabled={submitting}
                            style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', cursor: submitting ? 'default' : 'pointer', background: 'rgba(23,35,60,.72)', color: '#fff', borderRadius: '999px', padding: '5px 11px', fontSize: '11.5px', fontWeight: 700 }}
                          >
                            다시 고르기
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => evidenceInputRef.current?.click()}
                          style={{ width: '100%', height: '140px', borderRadius: '12px', background: '#F6F9FE', border: '1px dashed #B4C2D6', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0', fontSize: '13px', cursor: 'pointer' }}
                        >
                          <span>사진을 첨부해 주세요</span>
                          <span style={{ fontSize: '11px' }}>JPG · PNG · WebP · {MAX_EVIDENCE_LABEL} 까지</span>
                        </div>
                      )}
                    </div>
                  )}

                </div>
                <button onClick={submitReport} disabled={!canSubmit || submitting} style={{ border: 'none', cursor: canSubmit && !submitting ? 'pointer' : 'default', color: canSubmit && !submitting ? '#fff' : '#A8BCD9', background: canSubmit && !submitting ? '#E0554E' : '#EDF2FA', borderRadius: '12px', padding: '13px 16px', fontSize: '14px', fontWeight: 700 }}>{submitting ? '접수 중…' : '신고 접수'}</button>
              </div>
            </div>

            {/* 언어 설정 */}
            <div>
              <div className="ghead">언어</div>
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E6EDF7', position: 'relative', zIndex: 5 }}>
                <div className="cell" onClick={() => setLangOpen(true)} style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span className="ctitle">언어 설정</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5B93E0', fontWeight: 600 }}>
                    <img src={langMap[currentLang].icon} alt={langMap[currentLang].label} style={{ width: '20px', height: '14px', borderRadius: '3px', boxShadow: '0 0 0 1px rgba(47,99,184,.14)' }} />
                    {langMap[currentLang].label}
                  </div>
                </div>
              </div>
            </div>

            {/* 도움말 */}
            <div>
              <div className="ghead">도움말</div>
              <div className="group">
                <div className="cell" onClick={() => setFaqOpen(true)} style={{ cursor: 'pointer' }}>
                  <span className="ctitle">FAQ</span>
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}><path d="M1.2 1.2 6.6 7l-5.4 5.8" stroke="#B4C2D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <Link href="/support" className="cell">
                  <span className="ctitle">문의하기</span>
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}><path d="M1.2 1.2 6.6 7l-5.4 5.8" stroke="#B4C2D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </Link>
              </div>
            </div>

            {/* 버전 정보 */}
            <div>
              <div className="ghead">정보</div>
              <div className="group">
                <div className="cell">
                  <span className="ctitle">버전 정보</span>
                  <span className="cval">v1.0.0</span>
                </div>
              </div>
            </div>

            {/* ⭐️ 1. 확실하게 이동하는 로그아웃/탈퇴 버튼 */}
            <div className="group">
              <button onClick={handleLogout} className="cell" style={{ width: '100%', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14.5px', fontWeight: 600, color: '#2F63B8' }}>로그아웃</button>
              <button onClick={() => setWithdrawOpen(true)} className="cell" style={{ width: '100%', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14.5px', fontWeight: 600, color: '#E0554E' }}>회원탈퇴</button>
            </div>

            <div style={{ textAlign: 'center', fontSize: '11.5px', color: '#A8BCD9' }}>Washed · 버전 1.0.0</div>

          </div>
        </div>

        {/* 탭 바 */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '8px 0', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(112,115,124,.12)', height: '60px' }}>
          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center' }}>
            <Link href="/home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>홈</span>
            </Link>
            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>기록</span>
            </Link>
            <Link href="/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px', background: 'rgba(0,102,255,.08)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0066FF' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#0066FF' }}>설정</span>
            </Link>
          </div>
        </div>

        {/* 언어 설정 팝업 모달 */}
        {langOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(23,23,23,.45)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: '#fff', width: '100%', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid rgba(112,115,124,.12)' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>언어 설정 (Language)</span>
                <div onClick={() => setLangOpen(false)} style={{ cursor: 'pointer', color: 'rgba(55,56,60,.5)', fontSize: '20px', lineHeight: 1, padding: '2px 6px' }}>×</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px 24px', gap: '8px' }}>
                {Object.entries(langMap).map(([key, lang]) => (
                  <div key={key} onClick={() => { setCurrentLang(key); setLangOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', background: currentLang === key ? '#F2F7FD' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={lang.icon} alt={lang.label} style={{ width: '24px', height: '16px', borderRadius: '3px', boxShadow: '0 0 0 1px rgba(47,99,184,.14)' }} />
                      <span style={{ fontSize: '15px', fontWeight: currentLang === key ? 700 : 500, color: currentLang === key ? '#2F63B8' : '#1E3557' }}>{lang.label}</span>
                    </div>
                    {currentLang === key && <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-4.7" stroke="#2F63B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 모달: 회원탈퇴 */}
        {withdrawOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(20,42,84,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 40px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '22px 20px 0', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', overflow: 'hidden' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E3557' }}>탈퇴하시겠습니까?</span>
              <span style={{ fontSize: '13px', color: '#8FAAD0', lineHeight: 1.55, paddingBottom: '18px' }}>탈퇴 후 <b style={{ color: '#2F63B8' }}>14일</b> 안에 다시 로그인하면<br/>되돌릴 수 있어요. 14일이 지나면 이용 내역 · 경고 ·<br/>신고 기록이 모두 영구 삭제됩니다.</span>
              <div style={{ display: 'flex', width: 'calc(100% + 40px)', borderTop: '1px solid #EDF2F9' }}>
                <button onClick={() => setWithdrawOpen(false)} disabled={withdrawPending} style={{ flex: 1, border: 'none', cursor: withdrawPending ? 'default' : 'pointer', color: '#2F63B8', background: 'transparent', padding: '14px', fontSize: '15px', fontWeight: 600 }}>취소</button>
                <div style={{ width: '1px', background: '#EDF2F9' }}></div>
                <button onClick={handleWithdraw} disabled={withdrawPending} style={{ flex: 1, border: 'none', cursor: withdrawPending ? 'default' : 'pointer', color: withdrawPending ? '#A8BCD9' : '#E0554E', background: 'transparent', padding: '14px', fontSize: '15px', fontWeight: 700 }}>{withdrawPending ? '처리 중…' : '탈퇴하기'}</button>
              </div>
            </div>
          </div>
        )}

        {/* 모달: FAQ */}
        {faqOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(23,23,23,.45)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: '#fff', width: '100%', height: '86%', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid rgba(112,115,124,.12)' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>자주 묻는 질문</span>
                <div onClick={() => setFaqOpen(false)} style={{ cursor: 'pointer', color: 'rgba(55,56,60,.5)', fontSize: '20px', lineHeight: 1, padding: '2px 6px' }}>×</div>
              </div>
              <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {FAQ_KO.map((sec, sIdx) => (
                  <div key={sIdx}>
                    <div className="ghead">{sec.title}</div>
                    <div className="group">
                      {sec.items.map((q, qIdx) => {
                        const isOpen = openFaqId === q.id;
                        return (
                          <div key={q.id}>
                            <div onClick={() => setOpenFaqId(isOpen ? null : q.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '15px 16px', cursor: 'pointer', position: 'relative', borderTop: qIdx > 0 ? '1px solid #EDF2F9' : 'none' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#5B93E0', flexShrink: 0, lineHeight: 1.45 }}>Q</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: 600, color: isOpen ? '#1E3557' : '#33456B', lineHeight: 1.45 }}>{q.question}</span>
                              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ flexShrink: 0, marginTop: '5px', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#B4C2D6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            </div>
                            {isOpen && (
                              <div style={{ padding: '0 16px 16px 38px', fontSize: '13px', color: '#5A6E8F', lineHeight: 1.65, whiteSpace: 'pre-line', fontWeight: 400 }}>{q.answer}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 하단 토스트 알림 */}
        {toastVisible && (
          <div style={{ position: 'absolute', left: '50%', bottom: '74px', transform: 'translateX(-50%)', zIndex: 110, background: '#17233C', color: '#EEF4FD', borderRadius: '14px', padding: '11px 17px', fontSize: '12.5px', fontWeight: 600, boxShadow: '0 4px 12px rgba(20,42,84,.22)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '88%' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#5BD39A', flexShrink: 0 }}></div>
            <span>{toastMessage}</span>
          </div>
        )}

      </div>
    </>
  );
}
