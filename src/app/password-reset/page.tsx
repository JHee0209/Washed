'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

/**
 * 인증코드 유효 시간의 **기본값**이다 (05 P22 — 5분).
 * 실제 값은 서버가 응답의 minutes 로 준다. 여기 값은 응답이 오기 전 눈금용이다.
 */
const DEFAULT_LIMIT = 5 * 60 * 1000;

export default function PasswordResetPage() {
  // --- 상태 관리 ---
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  
  const [emailError, setEmailError] = useState(false);
  const [codeErrorText, setCodeErrorText] = useState('');
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
  const [emailErrorText, setEmailErrorText] = useState('');
  const [pwErrorText, setPwErrorText] = useState('');
  const [pending, setPending] = useState(false);

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
    setEmailErrorText('');
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
        setEmailErrorText(data.message ?? '인증코드를 보내지 못했어요.');
        return;
      }

      setLimit((data.minutes ?? 5) * 60 * 1000);
      setSentAt(Date.now());
      setCode('');
      setCodeErrorText('');
      setTicket('');
      if (data.devCode) setDevCode(data.devCode);
      setStep(2);
    } catch {
      setEmailErrorText('네트워크 오류예요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  };

  // 만료 · 틀림 · 5회 초과는 모두 서버가 갈라 문구까지 준다.
  const handleVerify = async () => {
    if (code.length !== 6 || pending) return;
    setPending(true);
    setCodeErrorText('');
    try {
      const res = await fetch('/api/auth/password-reset/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = (await res.json()) as { ok: boolean; ticket?: string; message?: string };

      if (!data.ok || !data.ticket) {
        setCodeErrorText(data.message ?? '인증코드가 올바르지 않아요.');
        return;
      }

      setTicket(data.ticket);
      setDevCode('');
      setStep(3);
    } catch {
      setCodeErrorText('네트워크 오류예요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async () => {
    if (!(pwLongEnough && pwMatch) || pending) return;
    setPending(true);
    setPwErrorText('');
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ticket, password: pw1 }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };

      if (!data.ok) {
        setPwErrorText(data.message ?? '비밀번호를 바꾸지 못했어요.');
        return;
      }

      setStep(4);
    } catch {
      setPwErrorText('네트워크 오류예요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  };

  const stepDefs = [
    { no: 1, label: '이메일 확인' },
    { no: 2, label: '인증' },
    { no: 3, label: '새 비밀번호' },
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

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px' }}>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>비밀번호 찾기</span>
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
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>가입할 때 쓴 학교 이메일을 입력하면<br/>인증코드를 보내드려요.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">아이디 (학교 이메일)</label>
                  <input className="fld" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(false); }} placeholder="name@eulji.ac.kr" />
                  {emailError && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>학교 이메일 형식(ac.kr)으로 입력해주세요.</span>}
                  {emailErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{emailErrorText}</span>}
                </div>

                {/*
                  05 P22 (팀 확정) — 구글로 가입한 계정은 비밀번호가 없어 재설정할 수
                  없다. 08 · 51줄: "화면은 구글 로그인으로 가는 길을 함께 보여줘야 한다 —
                  메시지만 띄우면 사용자가 갈 곳이 없다."
                */}
                {googleOnly && (
                  <div style={{ background: '#fff', border: '1px solid #E6EDF7', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: '#1E3557', lineHeight: 1.6, fontWeight: 600 }}>
                      구글 간편로그인으로 가입한 계정이에요.<br />구글 계정으로 로그인해주세요.
                    </span>
                    <button
                      type="button"
                      onClick={() => signIn('google', { callbackUrl: '/home' })}
                      style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}
                    >
                      구글 계정으로 로그인
                    </button>
                  </div>
                )}

                <button type="button" onClick={handleSendCode} disabled={email.trim() === '' || pending} style={btnStyle(email.trim() !== '' && !pending)}>
                  {pending ? '보내는 중…' : '인증코드 받기'}
                </button>
              </div>
            )}

            {/* Step 2: 인증코드 확인 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}><span style={{ color: '#2F63B8', fontWeight: 700 }}>{email}</span> 으로<br/>인증코드를 보냈어요. {Math.round(limit / 60000)}분 안에 입력해주세요.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">인증코드 6자리</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input className="fld" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setCodeErrorText(''); }} placeholder="000000" style={{ flex: 1, minWidth: 0, letterSpacing: '3px' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#E0554E', flexShrink: 0, minWidth: '44px', textAlign: 'right' }}>{mm}:{ss}</span>
                  </div>
                  {codeErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{codeErrorText}</span>}
                  {/* 개발 전용. MAIL_MODE=console 일 때만 서버가 내려준다 */}
                  {devCode && (
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2F63B8', background: '#EDF2FA', borderRadius: '8px', padding: '6px 8px' }}>
                      개발용 인증코드: {devCode}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* 다시 보내기도 서버를 거친다 — 60초 쿨다운 판정이 서버에 있다 */}
                  <button type="button" onClick={handleSendCode} disabled={pending} style={{ flex: 1, border: 'none', cursor: pending ? 'default' : 'pointer', color: '#2F63B8', background: '#fff', boxShadow: 'inset 0 0 0 1px #CFDDF2', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 700 }}>다시 보내기</button>
                  <button type="button" onClick={handleVerify} disabled={code.length !== 6 || pending} style={btnStyle(code.length === 6 && !pending)}>확인</button>
                </div>
              </div>
            )}

            {/* Step 3: 새 비밀번호 입력 */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>새로 쓸 비밀번호를 입력해주세요.<br/>8자 이상이어야 해요.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">새 비밀번호</label>
                  <input className="fld" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="8자 이상" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">새 비밀번호 확인</label>
                  <input className="fld" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호를 다시 입력해주세요" />
                  {pw1 !== '' && (
                    <span style={{ fontSize: '11.5px', color: pwLongEnough && pwMatch ? '#188A5E' : '#E0554E' }}>
                      {!pwLongEnough ? '비밀번호는 8자 이상이어야 해요.' : (pwMatch ? '비밀번호가 일치해요.' : '비밀번호가 일치하지 않아요.')}
                    </span>
                  )}
                </div>
                {pwErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{pwErrorText}</span>}
                <button type="button" onClick={handleSubmit} disabled={!(pwLongEnough && pwMatch) || pending} style={btnStyle(pwLongEnough && pwMatch && !pending)}>
                  {pending ? '변경 중…' : '비밀번호 변경'}
                </button>
              </div>
            )}

            {/* Step 4: 완료 화면 */}
            {step === 4 && (
              <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9.5 18 20 6" stroke="#188A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>비밀번호가 변경됐어요</div>
                <div style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>새 비밀번호로 다시 로그인해주세요.</div>
                <Link href="/login" style={{ marginTop: '10px', background: '#4C86D8', color: '#fff', borderRadius: '12px', padding: '11px 22px', fontSize: '13.5px', fontWeight: 700, textDecoration: 'none' }}>
                  로그인하러 가기
                </Link>
              </div>
            )}

            {/* 도움말 박스 */}
            {(step === 1 || step === 2) && (
              <div style={{ marginTop: '4px', background: '#fff', border: '1px solid #E6EDF7', borderRadius: '14px', padding: '14px 16px', fontSize: '12px', color: '#8FAAD0', lineHeight: 1.6 }}>
                메일이 오지 않으면 스팸함을 확인해주세요.<br/>그래도 받지 못했다면 관리자(031-740-7700)에게 연락주세요.
              </div>
            )}

          </div>
        </div>

      </div>
    </>
  );
}