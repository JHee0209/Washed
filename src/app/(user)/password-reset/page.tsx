'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

import { Rich } from '@/lib/i18n/rich';
import { useApiError, useT } from '@/lib/i18n/use-t';

/**
 * 오류를 **번역된 문장이 아니라 (서버 응답 + fallback key) 로** 담는다 (Issue #13).
 *
 * 문장을 state 에 넣어 두면, 오류가 떠 있는 채로 `washed_lang` 이 바뀌어도(다른 탭에서
 * 고르면 storage 이벤트로 이 화면도 다시 그려진다) 이미 만들어진 문장이 옛 언어로
 * 남는다. 원재료만 담고 **렌더 시점에** 현재 언어로 계산한다 —
 * qr-scanner.tsx · notifications-client.tsx 와 같은 방식이다.
 *
 * key 를 좁혀 두는 이유는 t() 가 치환 인자를 요구하지 않게 하려는 것이다(types.ts).
 */
type PwResetErrorKey =
  | 'pwReset.sendFailed'
  | 'pwReset.codeInvalid'
  | 'pwReset.changeFailed'
  | 'common.networkError';

type PwResetError = { body: unknown; fallbackKey: PwResetErrorKey } | null;

/**
 * 인증코드 유효 시간의 **기본값**이다 (05 P22 — 5분).
 * 실제 값은 서버가 응답의 minutes 로 준다. 여기 값은 응답이 오기 전 눈금용이다.
 */
const DEFAULT_LIMIT = 5 * 60 * 1000;

export default function PasswordResetPage() {
  const t = useT();
  const apiError = useApiError();
  // --- 상태 관리 ---
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  
  const [emailError, setEmailError] = useState(false);
  const [codeErrorSource, setCodeErrorSource] = useState<PwResetError>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  /** 서버가 준 유효 시간(ms). 05 P22 의 5분이 기본이다. */
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  /** verify-code 가 준 일회용 표. 새 비밀번호 저장이 이것을 들고 간다. */
  const [ticket, setTicket] = useState('');
  /** 개발(MAIL_MODE=console)에서만 내려온다. */
  const [devCode, setDevCode] = useState('');
  /**
   * 05 P22 · 08 · 51줄 — 구글로 가입한 계정은 비밀번호를 재설정할 수 없다.
   * 메시지만 띄우면 갈 곳이 없으므로 구글 로그인으로 가는 길을 함께 보여준다.
   */
  const [googleOnly, setGoogleOnly] = useState(false);
  const [emailErrorSource, setEmailErrorSource] = useState<PwResetError>(null);
  const [pwErrorSource, setPwErrorSource] = useState<PwResetError>(null);
  const [pending, setPending] = useState(false);

  // 렌더 시점에 현재 언어로 계산한다 — state 에는 문장이 아니라 원재료만 있다.
  // code → 번역 / code 없음 → 서버 message / 둘 다 없음 → 화면 문구 (api-error.ts)
  const resolveError = (source: PwResetError) =>
    source ? apiError(source.body, t(source.fallbackKey)) : '';
  const emailErrorText = resolveError(emailErrorSource);
  const codeErrorText = resolveError(codeErrorSource);
  const pwErrorText = resolveError(pwErrorSource);

  // --- 타이머 실시간 업데이트 ---
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // --- 유효성 검사 및 계산 ---
  const emailValid = /^[^\s@]+@[^\s@]+\.ac\.kr$/i.test(email.trim());
  const remain = Math.max(0, limit - (now - sentAt));
  const mm = String(Math.floor(remain / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
  
  const pwLongEnough = pw1.length >= 8;
  const pwMatch = pw1 !== '' && pw1 === pw2;

  // --- 버튼 스타일 ---
  const btnStyle = (on: boolean) =>
    on
      ? { flex: 1, border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 700 }
      : { flex: 1, border: 'none', cursor: 'default', color: '#A8BCD9', background: '#EDF2FA', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 700 };

  // --- 핸들러 함수 ---
  /**
   * 가입 여부는 드러나지 않는다 — 미가입도 이메일 가입도 똑같이 ok:true 다.
   * 갈라지는 것은 구글 전용 계정(409 google_only)뿐이고, 05 P22 가 사실대로
   * 알리기로 정한 것이다.
   */
  const handleSendCode = async () => {
    if (email.trim() === '' || pending) return;
    if (!emailValid) {
      setEmailError(true);
      return;
    }
    setPending(true);
    setEmailErrorSource(null);
    setGoogleOnly(false);
    setDevCode('');
    try {
      const res = await fetch('/api/auth/password-reset/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        minutes?: number;
        message?: string;
        reason?: string;
        devCode?: string;
      };

      if (!data.ok) {
        if (data.reason === 'google_only') {
          setGoogleOnly(true);
          return;
        }
        setEmailErrorSource({ body: data, fallbackKey: 'pwReset.sendFailed' });
        return;
      }

      setLimit((data.minutes ?? 5) * 60 * 1000);
      setSentAt(Date.now());
      setCode('');
      setCodeErrorSource(null);
      setTicket('');
      if (data.devCode) setDevCode(data.devCode);
      setStep(2);
    } catch {
      setEmailErrorSource({ body: null, fallbackKey: 'common.networkError' });
    } finally {
      setPending(false);
    }
  };

  // 만료 · 틀림 · 5회 초과는 모두 서버가 갈라 문구까지 준다.
  const handleVerify = async () => {
    if (code.length !== 6 || pending) return;
    setPending(true);
    setCodeErrorSource(null);
    try {
      const res = await fetch('/api/auth/password-reset/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = (await res.json()) as { ok: boolean; ticket?: string; message?: string };

      if (!data.ok || !data.ticket) {
        setCodeErrorSource({ body: data, fallbackKey: 'pwReset.codeInvalid' });
        return;
      }

      setTicket(data.ticket);
      setDevCode('');
      setStep(3);
    } catch {
      setCodeErrorSource({ body: null, fallbackKey: 'common.networkError' });
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async () => {
    if (!(pwLongEnough && pwMatch) || pending) return;
    setPending(true);
    setPwErrorSource(null);
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ticket, password: pw1 }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };

      if (!data.ok) {
        setPwErrorSource({ body: data, fallbackKey: 'pwReset.changeFailed' });
        return;
      }

      setStep(4);
    } catch {
      setPwErrorSource({ body: null, fallbackKey: 'common.networkError' });
    } finally {
      setPending(false);
    }
  };

  const stepDefs = [
    { no: 1, label: t('pwReset.step1') },
    { no: 2, label: t('pwReset.step2') },
    { no: 3, label: t('pwReset.step3') },
  ];

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
        html { overflow: hidden; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Malgun Gothic', sans-serif; box-sizing: border-box; }
        a { color: #2F63B8; text-decoration: none; }
        a:hover { color: #1F4E9C; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        input { background: #fff; transition: box-shadow .18s ease; }
        .lbl { font-size: 12.5px; font-weight: 700; color: #5A7CA8; }
        .fld { width: 100%; border: none; outline: none; border-radius: 12px; box-shadow: inset 0 0 0 1px #E6EDF7; padding: 13px 14px; font-size: 14px; color: #1E3557; }
        .fld:focus { box-shadow: inset 0 0 0 1.5px #5B93E0, 0 0 0 4px rgba(91,147,224,.14); }
        .step { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 700; }
      `}</style>

      <div className="app-frame" style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden' }}>
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px 12px', paddingTop: 'max(14px, env(safe-area-inset-top))', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '100%' }}>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>{t('pwReset.title')}</span>
        </div>

        {/* 메인 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* 상단 스텝퍼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {stepDefs.map((d) => {
                const done = step > d.no;
                const on = step === d.no;
                const color = on || done ? '#2F63B8' : '#A8BCD9';
                const bg = on ? '#4C86D8' : done ? '#CFE0F7' : '#E6EDF7';
                const fg = on ? '#fff' : done ? '#2F63B8' : '#A8BCD9';
                return (
                  <div key={d.no} className="step" style={{ color }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>{d.no}</span>
                    {d.label}
                  </div>
                );
              })}
            </div>

            {/* Step 1: 이메일 입력 */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t('pwReset.emailIntro')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">{t('pwReset.emailLabel')}</label>
                  <input className="fld" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(false); }} placeholder="name@eulji.ac.kr" />
                  {emailError && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{t('pwReset.emailInvalid')}</span>}
                  {emailErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{emailErrorText}</span>}
                </div>

                {/*
                  05 P22 (팀 확정) — 구글로 가입한 계정은 비밀번호가 없어 재설정할 수
                  없다. 08 · 51줄: "화면은 구글 로그인으로 가는 길을 함께 보여줘야 한다 —
                  메시지만 띄우면 사용자가 갈 곳이 없다."
                */}
                {googleOnly && (
                  <div style={{ background: '#fff', border: '1px solid #E6EDF7', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: '#1E3557', lineHeight: 1.6, fontWeight: 600, whiteSpace: 'pre-line' }}>
                      {t('login.googleOnlyNotice')}
                    </span>
                    <button
                      type="button"
                      onClick={() => signIn('google', { callbackUrl: '/home' })}
                      style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}
                    >
                      {t('login.googleOnlyButton')}
                    </button>
                  </div>
                )}

                <button type="button" onClick={handleSendCode} disabled={email.trim() === '' || pending} style={btnStyle(email.trim() !== '' && !pending)}>
                  {pending ? t('pwReset.sending') : t('pwReset.sendCode')}
                </button>
              </div>
            )}

            {/* Step 2: 인증코드 확인 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 이메일 주소만 강조된다 — 문장 가운데 조각이라 {email} 자리에 끼운다.
                    값 자체는 사용자가 입력한 주소라 번역하지 않는다 (05 P25). */}
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  <Rich
                    messageKey="pwReset.codeSent"
                    slots={{
                      email: <span style={{ color: '#2F63B8', fontWeight: 700 }}>{email}</span>,
                      minutes: Math.round(limit / 60000),
                    }}
                  />
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">{t('pwReset.codeLabel')}</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input className="fld" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setCodeErrorSource(null); }} placeholder="000000" style={{ flex: 1, minWidth: 0, letterSpacing: '3px' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#E0554E', flexShrink: 0, minWidth: '44px', textAlign: 'right' }}>{mm}:{ss}</span>
                  </div>
                  {codeErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{codeErrorText}</span>}
                  {/* 개발 전용. MAIL_MODE=console 일 때만 서버가 내려준다 */}
                  {devCode && (
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2F63B8', background: '#EDF2FA', borderRadius: '8px', padding: '6px 8px' }}>
                      {t('pwReset.devCode', { code: devCode })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* 다시 보내기도 서버를 거친다 — 60초 쿨다운 판정이 서버에 있다 */}
                  <button type="button" onClick={handleSendCode} disabled={pending} style={{ flex: 1, border: 'none', cursor: pending ? 'default' : 'pointer', color: '#2F63B8', background: '#fff', boxShadow: 'inset 0 0 0 1px #CFDDF2', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 700 }}>{t('pwReset.resend')}</button>
                  <button type="button" onClick={handleVerify} disabled={code.length !== 6 || pending} style={btnStyle(code.length === 6 && !pending)}>{t('common.confirm')}</button>
                </div>
              </div>
            )}

            {/* Step 3: 새 비밀번호 입력 */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t('pwReset.newPwIntro')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">{t('pwReset.newPwLabel')}</label>
                  <input className="fld" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder={t('pwReset.newPwPlaceholder')} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">{t('pwReset.newPwConfirmLabel')}</label>
                  <input className="fld" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={t('pwReset.newPwConfirmPlaceholder')} />
                  {pw1 !== '' && (
                    <span style={{ fontSize: '11.5px', color: pwLongEnough && pwMatch ? '#188A5E' : '#E0554E' }}>
                      {!pwLongEnough ? t('pwReset.pwTooShort') : (pwMatch ? t('pwReset.pwMatch') : t('pwReset.pwMismatch'))}
                    </span>
                  )}
                </div>
                {pwErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{pwErrorText}</span>}
                <button type="button" onClick={handleSubmit} disabled={!(pwLongEnough && pwMatch) || pending} style={btnStyle(pwLongEnough && pwMatch && !pending)}>
                  {pending ? t('pwReset.submitting') : t('pwReset.submit')}
                </button>
              </div>
            )}

            {/* Step 4: 완료 화면 */}
            {step === 4 && (
              <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9.5 18 20 6" stroke="#188A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>{t('pwReset.doneTitle')}</div>
                <div style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>{t('pwReset.doneBody')}</div>
                <Link href="/login" style={{ marginTop: '10px', background: '#4C86D8', color: '#fff', borderRadius: '12px', padding: '11px 22px', fontSize: '13.5px', fontWeight: 700, textDecoration: 'none' }}>
                  {t('pwReset.goLogin')}
                </Link>
              </div>
            )}

            {/* 도움말 박스 */}
            {(step === 1 || step === 2) && (
              <div style={{ marginTop: '4px', background: '#fff', border: '1px solid #E6EDF7', borderRadius: '14px', padding: '14px 16px', fontSize: '12px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {t('pwReset.helpNote')}
              </div>
            )}

          </div>
        </div>

      </div>
    </>
  );
}