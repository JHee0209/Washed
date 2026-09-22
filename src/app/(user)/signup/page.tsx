'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { PRIVACY } from '@/lib/i18n/content/privacy';
import { TERMS } from '@/lib/i18n/content/terms';
import { useApiError, useLang, useT } from '@/lib/i18n/use-t';

/**
 * 인증코드 칸 아래 오류를 **번역된 문장이 아니라 (서버 응답 + fallback key) 로** 담는다
 * (Issue #13). 문장을 state 에 넣어 두면, 오류가 떠 있는 채로 washed_lang 이 바뀌어도
 * (다른 탭에서 고르면 storage 이벤트로 이 화면도 다시 그려진다) 이미 만들어진 문장이
 * 옛 언어로 남는다. 원재료만 담고 **렌더 시점에** 현재 언어로 계산한다 —
 * qr-scanner.tsx · password-reset/page.tsx 와 같은 방식이다.
 *
 * key 를 좁혀 두는 이유는 t() 가 치환 인자를 요구하지 않게 하려는 것이다(types.ts).
 */
type SignupErrorKey = 'signup.codeSendFailed' | 'signup.codeWrong' | 'common.networkError';

type SignupErrorSource = { body: unknown; fallbackKey: SignupErrorKey } | null;

export default function SignupPage() {
  const t = useT();
  const apiError = useApiError();
  const lang = useLang();
  const router = useRouter();

  // 05 P11 — 구글 로그인은 가입 경로를 겸한다. 구글로 처음 들어온 사람은
  // users 에 줄이 없어 pendingSignup 이 서고, 이 화면의 **구글 모드**로 온다.
  //
  // 판정은 ?google=1 이 아니라 **세션**으로 한다 — 주소는 누구나 칠 수 있지만
  // pendingSignup 은 서버가 users 를 보고 정한다(auth.ts 의 jwt 콜백).
  const { data: session, update } = useSession();
  const googleMode = Boolean(session?.pendingSignup);
  const googleEmail = session?.user?.email ?? '';

  // --- 상태 관리 (State) ---
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [studentId, setStudentId] = useState('');
  const [room, setRoom] = useState('');
  
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'ok' | 'wrong' | null>(null);
  const [codeDeadline, setCodeDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  /** verify-code 가 준 일회용 표. 가입 제출이 코드가 아니라 이것을 들고 간다. */
  const [ticket, setTicket] = useState('');
  /** 서버가 준 문구를 그대로 보여준다 — 화면이 따로 만들지 않는다. */
  const [codeMessageSource, setCodeMessageSource] = useState<SignupErrorSource>(null);
  /** 개발(콘솔 모드)에서만 내려온다. 터미널을 보지 않아도 되게 화면에 띄운다. */
  const [devCode, setDevCode] = useState('');
  const [pending, setPending] = useState(false);
  /** 이름 칸을 사용자가 한 번이라도 고쳤는지. 고치기 전까지는 구글 값을 보여준다. */
  const [nameTouched, setNameTouched] = useState(false);
  
  const [agree, setAgree] = useState({ terms: false, privacy: false, age14: false, marketing: false });
  const [docOpen, setDocOpen] = useState<'terms' | 'privacy' | null>(null);
  const [docAgree, setDocAgree] = useState(false);
  const [docScrolledEnd, setDocScrolledEnd] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  
  const [pwVisible, setPwVisible] = useState(false);
  const [pw2Visible, setPw2Visible] = useState(false);

  // 렌더 시점에 현재 언어로 계산한다 — state 에는 문장이 아니라 원재료만 있다.
  // 우선순위는 api-error.ts 그대로다: code→번역 / code 없음→서버 message / 둘 다 없음→화면 문구
  const codeMessage = codeMessageSource
    ? apiError(codeMessageSource.body, t(codeMessageSource.fallbackKey))
    : '';

  // --- 타이머 & 토스트 알림 ---
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // 구글이 준 이름을 기본값으로 쓴다 (05 P11). 효과로 state 에 옮겨 담지 않고
  // 렌더에서 유도한다 — 옮겨 담으면 렌더가 한 번 더 돌고, 세션이 늦게 와서
  // 사용자가 이미 입력한 값을 덮을 수도 있다.
  const googleName = session?.user?.name ?? '';
  const effectiveName = !nameTouched && googleMode && googleName ? googleName : name;

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  // --- 폼 유효성 검사 로직 ---
  const emailValid = /^[^\s@]+@[^\s@]+\.ac\.kr$/i.test(userId.trim());
  const pwMismatch = password2.length > 0 && password !== password2;
  const pwMatch = password2.length > 0 && password === password2 && password.length > 0;
  
  const expired = codeDeadline ? now >= codeDeadline && !idVerified : false;
  const msLeft = codeDeadline ? Math.max(0, codeDeadline - now) : 0;
  const timerText = `${Math.floor(msLeft / 60000)}:${Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0')}`;
  
  const REQUIRED_KEYS = ['terms', 'privacy', 'age14'];
  const requiredOk = REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]);
  const nameOk = !!effectiveName.trim();
  const pwOk = password.length >= 8 && pwMatch;
  const schoolOk = !!school.trim();
  const studentIdOk = !!studentId.trim();
  const roomOk = !!room.trim();
  // 05 P11 — 구글 가입자는 이메일 인증도 비밀번호도 만들지 않는다.
  // (구글이 이미 메일 소유를 확인했고, 06 「사용자」의 비밀번호 칸은 비워 둔다.)
  const canSubmit =
    nameOk &&
    (googleMode || idVerified) &&
    (googleMode || pwOk) &&
    !!gender &&
    schoolOk &&
    studentIdOk &&
    roomOk &&
    requiredOk;

  // --- 핸들러 함수 ---
  // 코드는 서버가 만들어 메일로 보낸다 (08 · 25줄 — 화면이 만들지 않는다).
  // 남은 시간도 서버가 준 minutes 를 그대로 쓴다.
  const handleSendCode = async () => {
    if (!emailValid || pending) return;
    setPending(true);
    setCodeMessageSource(null);
    setDevCode('');
    try {
      const res = await fetch('/api/auth/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userId.trim() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        minutes?: number;
        message?: string;
        devCode?: string;
      };

      if (!data.ok) {
        // 400 형식 · 409 이미 가입 · 429 쿨다운 · 502 발송 실패 —
        // 문구는 서버 것을 그대로 쓴다.
        const message = apiError(data, t('signup.codeSendFailed'));
        setCodeMessageSource({ body: data, fallbackKey: 'signup.codeSendFailed' });
        showToast(message);
        return;
      }

      setCodeSent(true);
      setCode('');
      setCodeStatus(null);
      setTicket('');
      setCodeDeadline(Date.now() + (data.minutes ?? 3) * 60 * 1000);
      if (data.devCode) setDevCode(data.devCode);
      showToast(t('signup.codeSent', { email: userId.trim() }));
    } catch {
      showToast(t('common.networkError'));
    } finally {
      setPending(false);
    }
  };

  // 맞으면 일회용 표를 받는다. 틀림 · 만료 · 5회 초과는 서버가 갈라 준다.
  const handleVerifyCode = async () => {
    if (expired || idVerified || pending) return;
    setPending(true);
    setCodeMessageSource(null);
    try {
      const res = await fetch('/api/auth/signup/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userId.trim(), code: code.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; ticket?: string; message?: string };

      if (!data.ok || !data.ticket) {
        setCodeStatus('wrong');
        setCodeMessageSource({ body: data, fallbackKey: 'signup.codeWrong' });
        return;
      }

      setTicket(data.ticket);
      setIdVerified(true);
      setCodeStatus('ok');
      setDevCode('');
    } catch {
      setCodeStatus('wrong');
      setCodeMessageSource({ body: null, fallbackKey: 'common.networkError' });
    } finally {
      setPending(false);
    }
  };

  const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const prev = room;
    let digits;
    if (prev.endsWith('호') && raw === prev.slice(0, -1)) {
      digits = prev.slice(0, -1).replace(/[^0-9]/g, '').slice(0, -1);
    } else {
      digits = raw.replace(/[^0-9]/g, '');
    }
    setRoom(digits ? `${digits}호` : '');
  };

  const handleDocScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setDocScrolledEnd(true);
  };

  const toggleAgreeItem = (key: 'terms' | 'privacy' | 'age14' | 'marketing') => {
    if ((key === 'privacy' || key === 'terms') && !agree[key]) {
      setDocOpen(key);
      setDocScrolledEnd(false);
      return;
    }
    setAgree((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const allChecked = REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing;
    const next = !allChecked;
    if (next && !agree.terms) { setDocOpen('terms'); setDocScrolledEnd(false); return; }
    if (next && !agree.privacy) { setDocOpen('privacy'); setDocScrolledEnd(false); return; }
    setAgree({ terms: next, privacy: next, age14: next, marketing: next });
  };

  const confirmDoc = () => {
    if (!docAgree || !docOpen) return;
    setAgree((prev) => ({ ...prev, [docOpen]: true }));
    setDocOpen(null);
    setDocAgree(false);
    setDocScrolledEnd(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setShowErrors(true);
      showToast(t('signup.fillRequired'));
      return;
    }
    if (pending) return;

    setPending(true);
    setShowErrors(false);
    try {
      const url = googleMode ? '/api/auth/google/complete-signup' : '/api/auth/signup';
      const body = googleMode
        ? {
            // 이메일은 보내지 않는다 — 서버가 세션에서 읽는다.
            // 본문으로 받으면 남의 학교 이메일로 계정을 만들 수 있다.
            name: effectiveName.trim(),
            gender,
            school: school.trim(),
            studentId: studentId.trim(),
            room,
            agreed: true,
          }
        : {
            email: userId.trim(),
            ticket,
            password,
            name: effectiveName.trim(),
            gender,
            school: school.trim(),
            studentId: studentId.trim(),
            room,
            agreed: true,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; field?: string };

      if (!data.ok) {
        setShowErrors(true);
        showToast(apiError(data, t('signup.failed')));
        return;
      }

      if (googleMode) {
        // **세션을 먼저 갱신한다.** 토큰에 pendingSignup 이 남아 있으면
        // proxy.ts 가 홈에서 다시 /signup 으로 돌려보낸다. auth.ts 의 jwt 콜백이
        // 매번 users 를 다시 읽으므로 update() 한 번이면 꺼진다.
        await update();
        showToast(t('signup.doneToHome'));
        setTimeout(() => {
          router.push('/home');
          router.refresh();
        }, 900);
      } else {
        // 07 흐름표 — 이메일 가입은 로그인 화면으로 돌아간다.
        showToast(t('signup.doneToLogin'));
        setTimeout(() => router.push('/login'), 900);
      }
    } catch {
      showToast(t('common.networkError'));
    } finally {
      setPending(false);
    }
  };

  // --- SVG 아이콘 ---
  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {!open && <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="1.8" />}
    </svg>
  );

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
        input::placeholder { color: #A8BCD9; }
        input { background: #F6F9FE; transition: background .18s ease, box-shadow .18s ease; }
        input:focus { background: #fff; }
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div className="app-frame" style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden' }}>
        
        {/* 헤더 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px 12px', paddingTop: 'max(14px, env(safe-area-inset-top))', background: '#fff', borderBottom: '1px solid #EAF0FA' }}>
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
        </div>

        {/* 폼 영역 */}
        <div style={{ flex: '1 1 0', overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div style={{ padding: '22px 16px 32px', display: 'flex', flexDirection: 'column', gap: '18px', animation: 'riseIn .55s ease-out both' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3557', marginTop: '-2px' }}>{t('signup.title')}</h1>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#8FAAD0' }}>
                {googleMode ? t('signup.subtitleGoogle') : t('signup.subtitle')}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)' }}>
              
              {/* 이름 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.name')}</label>
                <input value={effectiveName} onChange={(e) => { setNameTouched(true); setName(e.target.value); }} placeholder={t('signup.namePlaceholder')} style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !nameOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !nameOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.nameRequired')}</span>}
              </div>

              {/* 아이디 (학교 이메일) — 구글 모드에서는 구글이 확인해 준 주소를 보여주기만 한다 */}
              {googleMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('signup.idLabel')}</label>
                  <input
                    value={googleEmail}
                    readOnly
                    style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: 'inset 0 0 0 1px #E3EBF7', padding: '12px 14px', fontSize: '13px', color: '#8FAAD0', background: '#F7FAFF' }}
                  />
                  <span style={{ fontSize: '11px', color: '#8FAAD0' }}>{t('signup.googleVerified')}</span>
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('signup.idLabel')}</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={userId} onChange={(e) => { setUserId(e.target.value); setCodeSent(false); setIdVerified(false); setCodeDeadline(null); }} placeholder="name@school.ac.kr" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${userId.length > 0 && !emailValid ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '13px', color: '#1E3557' }} />
                  <button type="button" onClick={handleSendCode} disabled={!emailValid || idVerified || pending} style={{ border: 'none', cursor: (!emailValid || idVerified) ? 'default' : 'pointer', color: (!emailValid || idVerified) ? '#A8BCD9' : '#2F63B8', background: (!emailValid || idVerified) ? '#EDF2FA' : '#fff', boxShadow: (!emailValid || idVerified) ? 'none' : 'inset 0 0 0 1.5px #CFDDF2', borderRadius: '14px', height: '39px', padding: '0 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {idVerified ? t('signup.verified') : (codeSent ? t('signup.resend') : t('signup.verify'))}
                  </button>
                </div>
                {userId.length > 0 && !emailValid && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.emailInvalid')}</span>}
                {showErrors && !idVerified && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.emailVerifyRequired')}</span>}
                
                {codeSent && !idVerified && (
                  <div style={{ display: 'flex', gap: '6px', paddingTop: '2px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input value={code} onChange={(e) => { setCode(e.target.value); setCodeStatus(null); }} disabled={idVerified} placeholder={t('signup.codePlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${expired || codeStatus === 'wrong' ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 50px 12px 14px', fontSize: '13px', color: '#1E3557' }} />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 700, color: expired ? '#E0554E' : '#8FAAD0' }}>{timerText}</span>
                    </div>
                    <button type="button" onClick={handleVerifyCode} disabled={idVerified || expired || pending} style={{ border: 'none', cursor: (idVerified || expired) ? 'default' : 'pointer', color: (idVerified || expired) ? '#A8BCD9' : '#2F63B8', background: (idVerified || expired) ? '#EDF2FA' : '#fff', boxShadow: (idVerified || expired) ? 'none' : 'inset 0 0 0 1.5px #CFDDF2', borderRadius: '14px', height: '39px', padding: '0 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {t('common.confirm')}
                    </button>
                  </div>
                )}
                {expired && !idVerified && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.codeExpired')}</span>}
                {/* 서버가 준 문구를 그대로 보여준다 — 만료 · 틀림 · 5회 초과 · 쿨다운이 여기로 온다 */}
                {codeMessage && <span style={{ fontSize: '11px', color: '#E0554E' }}>{codeMessage}</span>}
                {!codeMessage && codeStatus === 'wrong' && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.codeWrong')}</span>}
                {/*
                  개발 전용 안내. MAIL_MODE=console 일 때만 서버가 devCode 를 내려준다
                  (운영 빌드에서는 응답에 아예 없다 — 06 「이메일 인증코드」 · 08 · 25줄).
                */}
                {devCode && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#2F63B8', background: '#EDF2FA', borderRadius: '8px', padding: '6px 8px' }}>
                    {t('signup.devCode', { code: devCode })}
                  </span>
                )}
              </div>
              )}

              {/* 비밀번호 — 05 P11: 구글 가입자는 가입할 때 비밀번호를 만들지 않는다 */}
              {!googleMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('signup.pwLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <input type={pwVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signup.pwPlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && password.length < 8 ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 40px 12px 14px', fontSize: '14px', color: '#1E3557' }} />
                  {password.length > 0 && <button type="button" onClick={() => setPwVisible(!pwVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={pwVisible} /></button>}
                </div>
                {showErrors && password.length < 8 && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.pwTooShort')}</span>}
              </div>
              )}

              {/* 비밀번호 확인 */}
              {!googleMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('signup.pw2Label')}</label>
                <div style={{ position: 'relative' }}>
                  <input type={pw2Visible ? 'text' : 'password'} value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder={t('signup.pw2Placeholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${pwMismatch ? '#F0A9A4' : (pwMatch ? '#8ED3B4' : '#E3EBF7')}`, padding: '12px 40px 12px 14px', fontSize: '14px', color: '#1E3557' }} />
                  {password2.length > 0 && <button type="button" onClick={() => setPw2Visible(!pw2Visible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={pw2Visible} /></button>}
                </div>
                {pwMismatch && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.pwMismatch')}</span>}
                {pwMatch && <span style={{ fontSize: '11px', color: '#188A5E' }}>{t('signup.pwMatch')}</span>}
              </div>
              )}

              {/* 성별 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('signup.genderLabel')}</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div onClick={() => setGender('female')} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '12px', borderRadius: '14px', fontSize: '13.5px', fontWeight: 700, background: gender === 'female' ? 'rgba(91,147,224,.12)' : '#fff', color: gender === 'female' ? '#5B93E0' : '#1E3557', boxShadow: `inset 0 0 0 1px ${gender === 'female' ? '#5B93E0' : '#E3EBF7'}` }}>{t('signup.genderFemale')}</div>
                  <div onClick={() => setGender('male')} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '12px', borderRadius: '14px', fontSize: '13.5px', fontWeight: 700, background: gender === 'male' ? 'rgba(91,147,224,.12)' : '#fff', color: gender === 'male' ? '#5B93E0' : '#1E3557', boxShadow: `inset 0 0 0 1px ${gender === 'male' ? '#5B93E0' : '#E3EBF7'}` }}>{t('signup.genderMale')}</div>
                </div>
                {showErrors && !gender && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.genderRequired')}</span>}
              </div>

              {/* 소속(학교) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('signup.schoolLabel')}</label>
                <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder={t('signup.schoolPlaceholder')} style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !schoolOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !schoolOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.schoolRequired')}</span>}
              </div>

              {/* 학번 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.studentId')}</label>
                <input value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} placeholder={t('signup.studentIdPlaceholder')} style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !studentIdOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !studentIdOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.studentIdRequired')}</span>}
              </div>

              {/* 호실 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.room')}</label>
                <input value={room} onChange={handleRoomChange} placeholder={t('signup.roomPlaceholder')} style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !roomOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !roomOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.roomRequired')}</span>}
              </div>

            </div>

            {/* 약관 동의 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#fff', borderRadius: '20px', padding: '10px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', marginTop: '-9px' }}>
              <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px', cursor: 'pointer', borderBottom: '1px solid #EDF2FA' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '6px', background: REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing ? '#5B93E0' : '#fff', boxShadow: `inset 0 0 0 1px ${REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing ? '#5B93E0' : '#CFDDF2'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }}></div>}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('signup.agreeAll')}</span>
              </div>
              
              {[
                { key: 'terms', label: t('signup.agreeTerms'), link: true },
                { key: 'privacy', label: t('signup.agreePrivacy'), link: true },
                { key: 'age14', label: t('signup.agreeAge14'), link: false },
                { key: 'marketing', label: t('signup.agreeMarketing'), link: false },
              ].map((a) => (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 11px' }}>
                  <div onClick={() => toggleAgreeItem(a.key as any)} style={{ width: '16px', height: '16px', borderRadius: '5px', background: agree[a.key as keyof typeof agree] ? '#5B93E0' : '#fff', boxShadow: `inset 0 0 0 1px ${agree[a.key as keyof typeof agree] ? '#5B93E0' : '#CFDDF2'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {agree[a.key as keyof typeof agree] && <div style={{ width: '7px', height: '4px', borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }}></div>}
                  </div>
                  <span onClick={() => toggleAgreeItem(a.key as any)} style={{ fontSize: '12px', color: '#4A5F82', cursor: 'pointer', flex: 1 }}>{a.label}</span>
                  {a.link && <span onClick={() => { setDocOpen(a.key as any); setDocScrolledEnd(false); }} style={{ fontSize: '11px', color: '#5B93E0', cursor: 'pointer', fontWeight: 700 }}>{t('signup.view')}</span>}
                </div>
              ))}
            </div>
            {showErrors && !requiredOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>{t('signup.agreeRequired')}</span>}

            <button type="button" onClick={handleSubmit} disabled={pending} style={{ border: 'none', cursor: pending ? 'default' : 'pointer', color: '#fff', background: pending ? '#A8BCD9' : '#4C86D8', borderRadius: '14px', padding: '16px', fontSize: '16px', fontWeight: 700, boxShadow: '0px 8px 18px -6px rgba(47,99,184,.75)' }}>
              {pending ? t('common.processing') : t('signup.submit')}
            </button>
          </div>
        </div>

        {/* ⭐️ 텍스트가 모두 포함된 약관 모달 */}
        {docOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(23,23,23,.45)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: '#fff', width: '100%', height: '86%', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid rgba(112,115,124,.12)' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#171719' }}>{docOpen === 'terms' ? t('signup.docTerms') : t('signup.docPrivacy')}</span>
                <span onClick={() => { setDocOpen(null); setDocAgree(false); setDocScrolledEnd(false); }} style={{ fontSize: '18px', color: 'rgba(55,56,60,.61)', cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}>×</span>
              </div>
              
              <div onScroll={handleDocScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 서비스 이용약관 텍스트 */}
                {docOpen === 'terms' && (
                  <>
                    {TERMS[lang].map((section) => (
                      <div key={section.heading} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>{section.heading}</span>
                        {section.paragraphs.map((paragraph, i) => (
                          <span key={i} style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>{paragraph}</span>
                        ))}
                      </div>
                    ))}
                  </>
                )}

                {/* 개인정보 수집 및 이용 동의서 텍스트 */}
                {docOpen === 'privacy' && (
                  <>
                    <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>{PRIVACY[lang].intro}</span>
                    {PRIVACY[lang].sections.map((section) => (
                      <div key={section.heading} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>{section.heading}</span>
                        {section.paragraphs.map((paragraph, i) => (
                          <span key={i} style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>{paragraph}</span>
                        ))}
                      </div>
                    ))}
                  </>
                )}
                
              </div>

              <div style={{ flex: 'none', padding: '14px 18px 20px', borderTop: '1px solid rgba(112,115,124,.12)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!docScrolledEnd && <span style={{ fontSize: '11.5px', color: 'rgba(55,56,60,.61)' }}>{t('signup.docReadToEnd')}</span>}
                <div onClick={() => { if (docScrolledEnd) setDocAgree(!docAgree); }} style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: docScrolledEnd ? 'pointer' : 'default' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, background: docAgree ? '#0066FF' : '#fff', boxShadow: `inset 0 0 0 1px ${docAgree ? '#0066FF' : 'rgba(112,115,124,.32)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {docAgree && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-4.7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#171719' }}>{docOpen === 'terms' ? t('signup.docAgreeTerms') : t('signup.docAgreePrivacy')}</span>
                </div>
                <button type="button" onClick={confirmDoc} disabled={!docAgree || !docScrolledEnd} style={{ border: 'none', cursor: (docAgree && docScrolledEnd) ? 'pointer' : 'default', color: (docAgree && docScrolledEnd) ? '#fff' : 'rgba(55,56,60,.28)', background: (docAgree && docScrolledEnd) ? '#0066FF' : '#F4F4F5', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: 700 }}>{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        )}

        {/* 토스트 알림 */}
        {toastVisible && (
          <div style={{ position: 'absolute', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 110, background: '#254470', color: '#EEF4FD', borderRadius: '14px', padding: '11px 17px', fontSize: '12.5px', fontWeight: 600, boxShadow: '0px 10px 24px -8px rgba(20,42,84,.85)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '88%' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#5BD39A', flexShrink: 0 }}></div>
            <span>{toastMessage}</span>
          </div>
        )}

      </div>
    </>
  );
}