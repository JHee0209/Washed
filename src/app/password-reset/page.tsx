'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CODE = '135790';
const LIMIT = 5 * 60 * 1000;

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

  // --- 타이머 실시간 업데이트 ---
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // --- 유효성 검사 및 계산 ---
  const emailValid = /^[^\s@]+@[^\s@]+\.ac\.kr$/i.test(email.trim());
  const remain = Math.max(0, LIMIT - (now - sentAt));
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
  const handleSendCode = () => {
    if (email.trim() === '') return;
    if (!emailValid) {
      setEmailError(true);
      return;
    }
    setStep(2);
    setSentAt(Date.now());
    setCode('');
    setCodeErrorText('');
  };

  const handleVerify = () => {
    if (code.length !== 6) return;
    if (remain <= 0) {
      setCodeErrorText('인증 시간이 지났어요. 다시 보내기를 눌러주세요.');
      return;
    }
    if (code !== CODE) {
      setCodeErrorText('인증코드가 올바르지 않아요.');
      return;
    }
    setStep(3);
  };

  const handleSubmit = () => {
    if (pwLongEnough && pwMatch) {
      setStep(4);
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
                </div>
                <button type="button" onClick={handleSendCode} disabled={email.trim() === ''} style={btnStyle(email.trim() !== '')}>
                  인증코드 받기
                </button>
              </div>
            )}

            {/* Step 2: 인증코드 확인 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}><span style={{ color: '#2F63B8', fontWeight: 700 }}>{email}</span> 으로<br/>인증코드를 보냈어요. 5분 안에 입력해주세요.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="lbl">인증코드 6자리</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input className="fld" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setCodeErrorText(''); }} placeholder="000000" style={{ flex: 1, minWidth: 0, letterSpacing: '3px' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#E0554E', flexShrink: 0, minWidth: '44px', textAlign: 'right' }}>{mm}:{ss}</span>
                  </div>
                  {codeErrorText && <span style={{ fontSize: '11.5px', color: '#E0554E' }}>{codeErrorText}</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => { setSentAt(Date.now()); setCode(''); setCodeErrorText(''); }} style={{ flex: 1, border: 'none', cursor: 'pointer', color: '#2F63B8', background: '#fff', boxShadow: 'inset 0 0 0 1px #CFDDF2', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 700 }}>다시 보내기</button>
                  <button type="button" onClick={handleVerify} disabled={code.length !== 6} style={btnStyle(code.length === 6)}>확인</button>
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
                <button type="button" onClick={handleSubmit} disabled={!(pwLongEnough && pwMatch)} style={btnStyle(pwLongEnough && pwMatch)}>
                  비밀번호 변경
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