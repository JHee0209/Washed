'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useUnreadCount } from '@/lib/use-unread-count';
import { enablePush, permissionServerSnapshot, permissionSnapshot, subscribePushState } from '@/lib/push-client';
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
    { id: 'q9', question: '알림이 오지 않아요', answer: '· 먼저 휴대폰 설정에서 Washed의 알림 권한이 켜져 있는지 확인해 주세요.\n· 권한이 켜져 있다면 앱의 설정 > 알림 > "차례 10분 전 알림" 및 "이용 가능 알림"이 모두 켜져 있는지 확인해 주세요.\n· 방해 금지 모드나 절전 모드가 켜져 있으면 알림이 늦게 도착할 수 있습니다.' },
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
  const [tenMin, setTenMin] = useState(true);
  const [ready, setReady] = useState(true);

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

  // 05 P26 — 폰 알림 허용은 **운영체제 단위**다. 앱이 켤 수는 있어도(요청) 끌 수는
  // 없다 — granted 를 default 로 되돌리는 방법이 브라우저에 없기 때문이다. 그래서
  // 이 자리는 토글이 아니라 **상태 + 켜기**다. 거절한 사람이 다시 켜는 자리이기도
  // 하다("거절하면 설정에 「알림이 꺼져 있어요」 줄").
  const pushPermission = useSyncExternalStore(
    subscribePushState,
    permissionSnapshot,
    permissionServerSnapshot,
  );
  const [pushPending, setPushPending] = useState(false);

  const turnOnPush = async () => {
    if (pushPending) return;
    setPushPending(true);
    try {
      // enablePush 는 서버에 구독을 저장하지 못하면 던진다 — 권한만 켜지고
      // 알림은 오지 않는 상태를 성공이라고 말하지 않기 위해서다.
      const result = await enablePush();
      if (result === 'granted') showToast('폰 알림을 켰어요.');
      else showToast('브라우저에서 알림이 허용되지 않았어요.');
    } catch {
      showToast('알림을 켜지 못했어요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPushPending(false);
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
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#B7C6E0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  <svg width="56" height="56" viewBox="-7 -5.25 38 38" fill="#fff"><circle cx="12" cy="8.6" r="4.2"></circle><path d="M3.5 22c0-5 3.8-8 8.5-8s8.5 3 8.5 8"></path></svg>
                </div>
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
                폰 알림 허용 (05 P26 · F40 · F41).
                아래 두 토글(P13)과 **다른 것**이다 — 이쪽은 운영체제 단위 허용이라
                켜지 않으면 공지 · 경고 · 신고 결과까지 폰으로 오지 않는다.
              */}
              <div className="group" style={{ marginBottom: '10px' }}>
                <div className="cell">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/*
                      브라우저 권한(granted)과 서버에 구독이 저장돼 있는지는 **다른**
                      상태다 — 권한은 켜져 있어도 구독이 지워졌을 수 있다(푸시가
                      404 · 410 으로 돌아오면 서버가 지운다). 여기서는 구독 상태를
                      따로 조회하지 않으므로 **권한만 말한다.**
                      (구독은 홈 진입 때 syncPushSubscription 이 다시 맞춘다.)
                    */}
                    <div className="ctitle">
                      {pushPermission === 'granted' ? '폰 알림 권한이 켜져 있어요' : '알림이 꺼져 있어요'}
                    </div>
                    <div className="cdesc">
                      {pushPermission === 'granted'
                        ? '배정 · 종료 · 공지 알림을 폰으로 받을 수 있어요.'
                        : pushPermission === 'denied'
                          ? '브라우저가 알림을 차단했어요. 브라우저나 폰의 사이트 설정에서 직접 허용해주세요.'
                          : pushPermission === 'unsupported'
                            ? '이 브라우저는 폰 알림을 지원하지 않아요.'
                            : '켜면 앱을 닫아 두어도 차례와 종료를 알려드려요.'}
                    </div>
                  </div>
                  {pushPermission === 'default' && (
                    <button
                      type="button"
                      onClick={turnOnPush}
                      disabled={pushPending}
                      style={{ border: 'none', cursor: pushPending ? 'default' : 'pointer', color: '#fff', background: pushPending ? '#A8BCD9' : '#4C86D8', borderRadius: '999px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 700, flexShrink: 0 }}
                    >
                      {pushPending ? '켜는 중…' : '켜기'}
                    </button>
                  )}
                </div>
              </div>

              {/*
                05 P13 · F19 — 종류별 알림 설정은 **v2** 다. 06 「저장하지 않는 것」이
                "알림 수신 설정 … 지금은 항상 켜짐으로 본다" 로 저장 칸을 만들지 않았고,
                08 · 112줄이 "사용자 설정 테이블로" 를 남은 일로 적어 두었다.
                그래서 여기 토글은 아직 화면 상태일 뿐이며, **위의 폰 알림 허용과
                연결하지 않는다** — 종류 하나를 끈다고 전체 푸시가 꺼지면 공지 · 경고 ·
                신고 결과까지 함께 끊긴다.
              */}
              <div className="group">
                {[
                  { label: '차례 10분 전 알림', desc: '내 차례가 다가오면 미리 알려드려요 (준비 중)', on: tenMin, toggle: () => setTenMin(!tenMin) },
                  { label: '이용 가능 알림', desc: '기기를 바로 이용할 수 있을 때 알려드려요 (준비 중)', on: ready, toggle: () => setReady(!ready) }
                ].map((n, idx) => (
                  <div key={idx} className="cell">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ctitle">{n.label}</div>
                      <div className="cdesc">{n.desc}</div>
                    </div>
                    <div onClick={n.toggle} style={{ width: '40px', height: '24px', borderRadius: '999px', background: n.on ? '#5B93E0' : '#DFE7F1', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .22s ease' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: n.on ? '18px' : '2px', boxShadow: '0 1px 3px rgba(20,42,84,.22)', transition: 'left .22s ease' }}></div>
                    </div>
                  </div>
                ))}
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
