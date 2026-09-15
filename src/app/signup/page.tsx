'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();

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
  
  const [agree, setAgree] = useState({ terms: false, privacy: false, age14: false, marketing: false });
  const [docOpen, setDocOpen] = useState<'terms' | 'privacy' | null>(null);
  const [docAgree, setDocAgree] = useState(false);
  const [docScrolledEnd, setDocScrolledEnd] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  
  const [pwVisible, setPwVisible] = useState(false);
  const [pw2Visible, setPw2Visible] = useState(false);

  // --- 타이머 & 토스트 알림 ---
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

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
  const nameOk = !!name.trim();
  const pwOk = password.length >= 8 && pwMatch;
  const schoolOk = !!school.trim();
  const studentIdOk = !!studentId.trim();
  const roomOk = !!room.trim();
  const canSubmit = nameOk && idVerified && pwOk && !!gender && schoolOk && studentIdOk && roomOk && requiredOk;

  // --- 핸들러 함수 ---
  const handleSendCode = () => {
    if (!emailValid) return;
    setCodeSent(true);
    setCode('');
    setCodeStatus(null);
    setCodeDeadline(Date.now() + 3 * 60 * 1000);
    showToast(`${userId}로 인증번호를 보냈어요.`);
  };

  const handleVerifyCode = () => {
    if (expired) return;
    if (code.trim() === '123456') {
      setIdVerified(true);
      setCodeStatus('ok');
    } else {
      setCodeStatus('wrong');
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

  const handleSubmit = () => {
    if (canSubmit) {
      showToast('가입이 완료됐어요! 홈으로 이동합니다.');
      setShowErrors(false);
      setTimeout(() => router.push('/home'), 900);
    } else {
      setShowErrors(true);
      showToast('필수 항목을 모두 입력·확인해주세요.');
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

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 헤더 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '54px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA' }}>
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
        </div>

        {/* 폼 영역 */}
        <div style={{ flex: '1 1 0', overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div style={{ padding: '22px 16px 32px', display: 'flex', flexDirection: 'column', gap: '18px', animation: 'riseIn .55s ease-out both' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3557', marginTop: '-2px' }}>회원가입</h1>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#8FAAD0' }}>기숙사 세탁실을 편하게 이용해 보세요</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)' }}>
              
              {/* 이름 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>이름</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력해 주세요" style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !nameOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !nameOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>이름을 입력해주세요.</span>}
              </div>

              {/* 아이디 (학교 이메일) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>아이디 (학교 이메일)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={userId} onChange={(e) => { setUserId(e.target.value); setCodeSent(false); setIdVerified(false); setCodeDeadline(null); }} placeholder="name@school.ac.kr" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${userId.length > 0 && !emailValid ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '13px', color: '#1E3557' }} />
                  <button type="button" onClick={handleSendCode} disabled={!emailValid || idVerified} style={{ border: 'none', cursor: (!emailValid || idVerified) ? 'default' : 'pointer', color: (!emailValid || idVerified) ? '#A8BCD9' : '#2F63B8', background: (!emailValid || idVerified) ? '#EDF2FA' : '#fff', boxShadow: (!emailValid || idVerified) ? 'none' : 'inset 0 0 0 1.5px #CFDDF2', borderRadius: '14px', height: '39px', padding: '0 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {idVerified ? '인증완료' : (codeSent ? '재발송' : '인증하기')}
                  </button>
                </div>
                {userId.length > 0 && !emailValid && <span style={{ fontSize: '11px', color: '#E0554E' }}>학교 이메일 형식(ac.kr)으로 입력해주세요.</span>}
                {showErrors && !idVerified && <span style={{ fontSize: '11px', color: '#E0554E' }}>이메일 인증을 완료해주세요.</span>}
                
                {codeSent && !idVerified && (
                  <div style={{ display: 'flex', gap: '6px', paddingTop: '2px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input value={code} onChange={(e) => { setCode(e.target.value); setCodeStatus(null); }} disabled={idVerified} placeholder="인증번호 6자리" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${expired || codeStatus === 'wrong' ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 50px 12px 14px', fontSize: '13px', color: '#1E3557' }} />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 700, color: expired ? '#E0554E' : '#8FAAD0' }}>{timerText}</span>
                    </div>
                    <button type="button" onClick={handleVerifyCode} disabled={idVerified || expired} style={{ border: 'none', cursor: (idVerified || expired) ? 'default' : 'pointer', color: (idVerified || expired) ? '#A8BCD9' : '#2F63B8', background: (idVerified || expired) ? '#EDF2FA' : '#fff', boxShadow: (idVerified || expired) ? 'none' : 'inset 0 0 0 1.5px #CFDDF2', borderRadius: '14px', height: '39px', padding: '0 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      확인
                    </button>
                  </div>
                )}
                {expired && !idVerified && <span style={{ fontSize: '11px', color: '#E0554E' }}>인증 시간이 만료됐어요. 재발송해주세요.</span>}
                {codeStatus === 'wrong' && <span style={{ fontSize: '11px', color: '#E0554E' }}>인증번호가 일치하지 않아요.</span>}
              </div>

              {/* 비밀번호 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>비밀번호</label>
                <div style={{ position: 'relative' }}>
                  <input type={pwVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && password.length < 8 ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 40px 12px 14px', fontSize: '14px', color: '#1E3557' }} />
                  {password.length > 0 && <button type="button" onClick={() => setPwVisible(!pwVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={pwVisible} /></button>}
                </div>
                {showErrors && password.length < 8 && <span style={{ fontSize: '11px', color: '#E0554E' }}>비밀번호는 8자 이상이어야 해요.</span>}
              </div>

              {/* 비밀번호 확인 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>비밀번호 확인</label>
                <div style={{ position: 'relative' }}>
                  <input type={pw2Visible ? 'text' : 'password'} value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="비밀번호를 다시 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${pwMismatch ? '#F0A9A4' : (pwMatch ? '#8ED3B4' : '#E3EBF7')}`, padding: '12px 40px 12px 14px', fontSize: '14px', color: '#1E3557' }} />
                  {password2.length > 0 && <button type="button" onClick={() => setPw2Visible(!pw2Visible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={pw2Visible} /></button>}
                </div>
                {pwMismatch && <span style={{ fontSize: '11px', color: '#E0554E' }}>비밀번호가 일치하지 않아요.</span>}
                {pwMatch && <span style={{ fontSize: '11px', color: '#188A5E' }}>비밀번호가 일치해요.</span>}
              </div>

              {/* 성별 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>성별</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div onClick={() => setGender('female')} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '12px', borderRadius: '14px', fontSize: '13.5px', fontWeight: 700, background: gender === 'female' ? 'rgba(91,147,224,.12)' : '#fff', color: gender === 'female' ? '#5B93E0' : '#1E3557', boxShadow: `inset 0 0 0 1px ${gender === 'female' ? '#5B93E0' : '#E3EBF7'}` }}>여성</div>
                  <div onClick={() => setGender('male')} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '12px', borderRadius: '14px', fontSize: '13.5px', fontWeight: 700, background: gender === 'male' ? 'rgba(91,147,224,.12)' : '#fff', color: gender === 'male' ? '#5B93E0' : '#1E3557', boxShadow: `inset 0 0 0 1px ${gender === 'male' ? '#5B93E0' : '#E3EBF7'}` }}>남성</div>
                </div>
                {showErrors && !gender && <span style={{ fontSize: '11px', color: '#E0554E' }}>성별을 선택해주세요.</span>}
              </div>

              {/* 소속(학교) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>소속(학교)</label>
                <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="학교명을 입력해 주세요" style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !schoolOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !schoolOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>소속(학교)을 입력해주세요.</span>}
              </div>

              {/* 학번 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>학번</label>
                <input value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} placeholder="학번을 입력해 주세요" style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !studentIdOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !studentIdOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>학번을 입력해주세요.</span>}
              </div>

              {/* 호실 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>호실</label>
                <input value={room} onChange={handleRoomChange} placeholder="예: 302호" style={{ border: 'none', outline: 'none', borderRadius: '14px', boxShadow: `inset 0 0 0 1px ${showErrors && !roomOk ? '#F0A9A4' : '#E3EBF7'}`, padding: '12px 14px', fontSize: '14px', color: '#1E3557' }} />
                {showErrors && !roomOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>호실을 입력해주세요.</span>}
              </div>

            </div>

            {/* 약관 동의 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#fff', borderRadius: '20px', padding: '10px', boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)', marginTop: '-9px' }}>
              <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px', cursor: 'pointer', borderBottom: '1px solid #EDF2FA' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '6px', background: REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing ? '#5B93E0' : '#fff', boxShadow: `inset 0 0 0 1px ${REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing ? '#5B93E0' : '#CFDDF2'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {REQUIRED_KEYS.every((k) => agree[k as keyof typeof agree]) && agree.marketing && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }}></div>}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>전체 동의</span>
              </div>
              
              {[
                { key: 'terms', label: '서비스 이용약관 동의 (필수)', link: true },
                { key: 'privacy', label: '개인정보 수집 · 이용 동의 (필수)', link: true },
                { key: 'age14', label: '만 14세 이상입니다 (필수)', link: false },
                { key: 'marketing', label: '앱 push 동의합니다 (선택)', link: false },
              ].map((a) => (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 11px' }}>
                  <div onClick={() => toggleAgreeItem(a.key as any)} style={{ width: '16px', height: '16px', borderRadius: '5px', background: agree[a.key as keyof typeof agree] ? '#5B93E0' : '#fff', boxShadow: `inset 0 0 0 1px ${agree[a.key as keyof typeof agree] ? '#5B93E0' : '#CFDDF2'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {agree[a.key as keyof typeof agree] && <div style={{ width: '7px', height: '4px', borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }}></div>}
                  </div>
                  <span onClick={() => toggleAgreeItem(a.key as any)} style={{ fontSize: '12px', color: '#4A5F82', cursor: 'pointer', flex: 1 }}>{a.label}</span>
                  {a.link && <span onClick={() => { setDocOpen(a.key as any); setDocScrolledEnd(false); }} style={{ fontSize: '11px', color: '#5B93E0', cursor: 'pointer', fontWeight: 700 }}>보기 ›</span>}
                </div>
              ))}
            </div>
            {showErrors && !requiredOk && <span style={{ fontSize: '11px', color: '#E0554E' }}>필수 약관에 모두 동의해주세요.</span>}

            <button type="button" onClick={handleSubmit} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '14px', padding: '16px', fontSize: '16px', fontWeight: 700, boxShadow: '0px 8px 18px -6px rgba(47,99,184,.75)' }}>
              가입하기
            </button>
          </div>
        </div>

        {/* ⭐️ 텍스트가 모두 포함된 약관 모달 */}
        {docOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(23,23,23,.45)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: '#fff', width: '100%', height: '86%', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid rgba(112,115,124,.12)' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#171719' }}>{docOpen === 'terms' ? '서비스 이용약관' : '개인정보 수집 · 이용 동의서'}</span>
                <span onClick={() => { setDocOpen(null); setDocAgree(false); setDocScrolledEnd(false); }} style={{ fontSize: '18px', color: 'rgba(55,56,60,.61)', cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}>×</span>
              </div>
              
              <div onScroll={handleDocScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 서비스 이용약관 텍스트 */}
                {docOpen === 'terms' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>제1조 (약관의 개정)</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있으며, 적용일자 7일 전(회원에게 불리한 개정은 30일 전)부터 앱 내 공지사항 및 알림을 통해 공지합니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>필수항목: 이름, 이메일, 학교 이메일 주소, 비밀번호, 성별, 소속(학교), 호실</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>개정 약관에 동의하지 않는 회원은 언제든지 이용계약을 해지(탈퇴)할 수 있습니다. 탈퇴를 신청하면 즉시 서비스 이용이 정지되고, 14일 이내에 다시 로그인하면 계정이 복구됩니다. 복구 기간에는 같은 학교 이메일로 새로 가입할 수 없습니다.</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>제2조 (서비스의 성격 및 제공)</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 기기의 예약 및 사용 순서에 관한 정보 서비스를 제공할 뿐이며, 기기의 소유·설치·관리·수리 및 세탁 결과에 대한 주체가 아닙니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>서비스는 연중무휴 제공을 원칙으로 하나, 시스템 점검·설비 장애·기숙사 사정 등의 사유로 전부 또는 일부가 중단되거나 변경될 수 있으며, 이 경우 사전에 공지합니다. 다만 부득이한 경우 사후에 공지할 수 있습니다.</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>제3조 (예약 및 이용 규칙)</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>예약 가능 횟수, 시간, 취소 기한 등 구체적인 운영 기준은 서비스 내 안내 또는 운영정책에 따르며, 기숙사의 운영방침에 따라 변경될 수 있습니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회원은 이용이 어려워진 경우 다른 회원을 위하여 지체 없이 예약을 취소하여야 합니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회원이 예약 시간에 기기를 사용하지 않는 경우(노쇼) 해당 예약은 자동으로 취소될 수 있으며, 반복되는 경우 제5조에 따라 예약 이용이 제한될 수 있습니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회원은 사용 종료 후 즉시 세탁물을 수거하여 다음 순번의 회원이 기기를 사용할 수 있도록 협조하여야 합니다.</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>제4조 (금지행위)</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회원은 다음 행위를 하여서는 안 됩니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>타인의 계정으로 예약하거나 대리 예약하는 행위</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>실제 사용 의사 없이 예약을 선점하거나 반복적으로 예약·취소하는 행위</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>다른 회원의 예약 순서를 침해하거나 무단으로 기기를 사용하는 행위</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>자동화된 수단(매크로, 봇 등)을 이용하여 예약하거나 서비스에 접속하는 행위</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>서비스의 정상적인 운영을 방해하는 행위</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>기타 관련 법령 또는 기숙사 운영규정에 위배되는 행위</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>제5조 (이용 제한)</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 회원이 본 약관을 위반한 경우 경고, 일정 기간 예약 제한, 서비스 이용정지 등의 조치를 단계적으로 할 수 있습니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 이용 제한 시 그 사유와 기간, 이의신청 방법을 회원에게 통지하며, 회원의 이의가 정당하다고 인정되면 즉시 이용을 재개합니다.</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>제6조 (면책)</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 세탁물의 분실, 도난, 훼손, 세탁 결과 및 기기의 고장·오작동으로 인한 손해에 대하여 책임을 지지 않습니다. 해당 사항은 기기 관리주체 또는 기숙사에 문의하여야 합니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 회원 간 예약 순서나 세탁물 처리를 둘러싸고 발생한 분쟁에 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회사는 천재지변, 정전, 통신장애 등 불가항력이나 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>본 서비스는 무료로 제공되며, 회사는 관련 법령에 특별한 규정이 없는 한 무료 서비스의 이용과 관련하여 책임을 지지 않습니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>다만 회사의 고의 또는 중대한 과실로 인한 손해에 대해서는 그러하지 아니합니다.</span>
                    </div>
                  </>
                )}

                {/* 개인정보 수집 및 이용 동의서 텍스트 */}
                {docOpen === 'privacy' && (
                  <>
                    <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>Washed는 다음과 같이 개인정보를 수집·이용합니다.</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>1. 수집하는 개인정보 항목</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>필수항목: 이름, 이메일, 학생/학교 이메일 주소, 비밀번호, 성별, 소속(학교), 주소</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>수집방법: 회원가입 시 직접 입력</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>2. 개인정보의 수집 및 이용 목적</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>회원 가입 및 관리</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>서비스 제공 및 계약이행</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>이용자 식별 및 인증</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>서비스 개선 및 신규 서비스 개발</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>통지, 공지사항 전달 등 커뮤니케이션</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>법적 의무 이행</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>3. 개인정보의 보유 및 이용 기간</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>보유기간: 회원 탈퇴 신청일로부터 14일까지. 탈퇴 신청 후 14일 이내에 다시 로그인하면 계정이 복구되며, 14일이 지나면 모든 개인정보를 영구 파기합니다. 세탁실 이용 내역 · 경고 기록 · 신고(증거 사진 포함)는 분쟁 처리를 위해 3개월간 보관하며, 3개월이 지나거나 탈퇴 후 14일이 지나거나 둘 중 먼저 오는 때에 파기합니다.</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>동의 철회 시: 탈퇴 신청 후 14일의 복구 기간이 지나면 지체 없이 파기합니다 (단, 법령에서 일정 기간 보관을 의무화하는 경우는 제외)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>4. 개인정보 처리의 위탁</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>필요한 경우 다음과 같이 개인정보 처리를 위탁할 수 있습니다:</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>이메일 발송 서비스 제공업체</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>클라우드 서버 운영업체</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>5. 정보주체의 권리</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>귀하는 언제든지 다음의 권리를 행사할 수 있습니다:</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>개인정보 열람 요청</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>오류 정정 요청</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>삭제 요청</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>처리 정지 요청</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>6. 개인정보 보안</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>당사는 개인정보 보호를 위해 물리적, 기술적, 관리적 안전조치를 취합니다.</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#171719' }}>7. 문의</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>개인정보 관련 문의사항이 있으신 경우:</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>이메일: [고객지원이메일]</span>
                      <span style={{ fontSize: '12.5px', color: 'rgba(55,56,60,.88)', lineHeight: 1.6 }}>전화: [고객지원번호]</span>
                    </div>
                  </>
                )}
                
              </div>

              <div style={{ flex: 'none', padding: '14px 18px 20px', borderTop: '1px solid rgba(112,115,124,.12)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!docScrolledEnd && <span style={{ fontSize: '11.5px', color: 'rgba(55,56,60,.61)' }}>약관 내용을 끝까지 읽어야 동의할 수 있어요.</span>}
                <div onClick={() => { if (docScrolledEnd) setDocAgree(!docAgree); }} style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: docScrolledEnd ? 'pointer' : 'default' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, background: docAgree ? '#0066FF' : '#fff', boxShadow: `inset 0 0 0 1px ${docAgree ? '#0066FF' : 'rgba(112,115,124,.32)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {docAgree && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-4.7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#171719' }}>본인은 위의 {docOpen === 'terms' ? '서비스 이용약관' : '개인정보 수집 및 이용'}에 동의합니다.</span>
                </div>
                <button type="button" onClick={confirmDoc} disabled={!docAgree || !docScrolledEnd} style={{ border: 'none', cursor: (docAgree && docScrolledEnd) ? 'pointer' : 'default', color: (docAgree && docScrolledEnd) ? '#fff' : 'rgba(55,56,60,.28)', background: (docAgree && docScrolledEnd) ? '#0066FF' : '#F4F4F5', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: 700 }}>확인</button>
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