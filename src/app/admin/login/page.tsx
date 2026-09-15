'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';

import { loginAction } from './actions';

// 계정은 admin_accounts 표에 있다 (06 「관리자 계정」 · 05 P12 · 08 · 1번).
// 만드는 자리는 `npm run admin:create <아이디> <비밀번호>` 다.
// 검증은 서버에서만 한다 — loginAction → adminSignIn() 이 washed-admin 쿠키를 심는다.

export default function AdminLoginPage() {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');

  // --- 상태 관리 ---
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [showError, setShowError] = useState(false);
  const [remember, setRemember] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // --- 컴포넌트 마운트 시 저장된 아이디 불러오기 ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem('washed_admin_id');
      if (saved) {
        setAdminId(saved);
        setRemember(true);
      }
    } catch (e) {}
  }, []);

  // --- 핸들러 함수 ---
  // 아이디 · 비밀번호는 서버가 본다. 맞으면 loginAction 안의 redirect('/admin') 이
  // 이동까지 처리하므로 여기서 router.push 를 부르지 않는다.
  const handleLogin = () => {
    if (pending) return;
    setShowError(false);

    // 아이디 저장은 기기 편의 기능이라 그대로 둔다 (비밀번호는 저장하지 않는다).
    try {
      if (remember) {
        localStorage.setItem('washed_admin_id', adminId.trim());
      } else {
        localStorage.removeItem('washed_admin_id');
      }
    } catch (e) {}

    const formData = new FormData();
    formData.set('loginId', adminId.trim());
    formData.set('password', password);

    startTransition(async () => {
      // 어느 쪽이 틀렸는지 구별해 알려주지 않는다 (admin-session.ts)
      const message = await loginAction(null, formData);
      if (message) {
        setErrorMsg(message);
        setShowError(true);
      }
    });
  };

  // 비밀번호 표시 아이콘 (눈 모양)
  const EyeIcon = ({ open }: { open: boolean }) => (
    open ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  );

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #F3F6FB; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Malgun Gothic', sans-serif; box-sizing: border-box; }
        a { color: #2F63B8; text-decoration: none; }
        a:hover { color: #1F4E9C; }
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
        @keyframes markSettle { 0% { opacity: 0; transform: scale(.86) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: scale(1) } }
        
        .field { width: 100%; height: 52px; padding: 0 16px; border-radius: 14px; border: 1.5px solid #E3EBF7; background: #fff; font-size: 15px; font-weight: 500; color: #1E3557; transition: border-color .18s ease, box-shadow .18s ease; }
        .field::placeholder { color: #A8BCD9; font-weight: 400; }
        .field:focus { outline: none; border-color: #5B93E0; box-shadow: 0 0 0 4px rgba(91,147,224,.14); }
        
        .primary { width: 100%; height: 54px; border: 0; border-radius: 14px; cursor: pointer; background: linear-gradient(180deg, #5B93E0 0%, #3B76CC 100%); color: #fff; font-size: 16px; font-weight: 700; letter-spacing: -.2px; box-shadow: 0 8px 20px rgba(47,99,184,.28); transition: transform .12s ease, box-shadow .18s ease; }
        .primary:active { transform: translateY(1px); box-shadow: 0 4px 12px rgba(47,99,184,.24); }
        
        .check { position: absolute; opacity: 0; width: 0; height: 0; }
        .check + span { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #CFDDF2; background: #fff; display: inline-flex; align-items: center; justify-content: center; flex: none; transition: all .15s ease; }
        .check + span svg { opacity: 0; transition: opacity .15s ease; }
        .check:checked + span { background: #5B93E0; border-color: #5B93E0; }
        .check:checked + span svg { opacity: 1; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#F3F6FB', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-260px', left: '50%', transform: 'translateX(-50%)', width: '820px', height: '820px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,147,224,.14) 0%, rgba(91,147,224,0) 62%)', pointerEvents: 'none' }}></div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '26px' }}>
            <div style={{ width: '76px', height: '76px', borderRadius: '22px', background: '#fff', boxShadow: '0 10px 24px rgba(47,99,184,.14), 0 2px 6px rgba(47,99,184,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'markSettle .8s cubic-bezier(.22,1,.36,1) both' }}>
              <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
            </div>
            <div style={{ marginTop: '16px', fontSize: '30px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-1px', lineHeight: 1.15, whiteSpace: 'nowrap', animation: 'riseIn .7s cubic-bezier(.22,1,.36,1) .2s both' }}>Washed <span style={{ color: '#1E3557' }}>관리자</span></div>
            <div style={{ marginTop: '9px', fontSize: '13px', fontWeight: 600, color: '#6B8CB8', letterSpacing: '-.2px', whiteSpace: 'nowrap', animation: 'riseIn .7s ease-out .32s both' }}>기기 · 대기열 · 신고 관리 콘솔</div>
          </div>

          <div style={{ width: '100%', background: '#fff', borderRadius: '24px', padding: '26px 22px 22px', boxShadow: '0 14px 36px rgba(47,99,184,.12), 0 2px 8px rgba(47,99,184,.05)', animation: 'riseIn .8s cubic-bezier(.22,1,.36,1) .42s both' }}>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#33456B', marginBottom: '8px' }}>관리자 아이디</label>
            <input className="field" type="text" value={adminId} onChange={(e) => { setAdminId(e.target.value); setShowError(false); }} placeholder="관리자 아이디를 입력해 주세요" />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#33456B', margin: '18px 0 8px' }}>비밀번호</label>
            <div style={{ position: 'relative' }}>
              <input className="field" type={pwVisible ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setShowError(false); }} placeholder="비밀번호를 입력해 주세요" style={{ paddingRight: '44px' }} />
              {password.length > 0 && (
                <button type="button" onClick={() => setPwVisible(!pwVisible)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}>
                  <EyeIcon open={pwVisible} />
                </button>
              )}
            </div>

            {showError && (
              <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#E0554E' }}>{errorMsg || '아이디 또는 비밀번호가 올바르지 않습니다.'}</div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 500, color: '#5A6E8F', cursor: 'pointer', position: 'relative' }}>
                <input className="check" type="checkbox" checked={remember} onChange={() => setRemember(!remember)} />
                <span>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.3L4.8 8.6L9.5 3.7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </span>
                아이디 저장
              </label>
              <span onClick={() => setHelpOpen(true)} style={{ fontSize: '13px', fontWeight: 600, color: '#2F63B8', whiteSpace: 'nowrap', cursor: 'pointer' }}>비밀번호 재발급 문의</span>
            </div>

            <button className="primary" onClick={handleLogin} disabled={pending}>{pending ? '확인 중…' : '로그인'}</button>
          </div>

          <div style={{ marginTop: '22px', fontSize: '12.5px', fontWeight: 500, color: '#6B8CB8', textAlign: 'center', lineHeight: 1.6, animation: 'riseIn .7s ease-out .6s both' }}>
            관리자 계정은 기숙사 행정실에서 발급합니다.<br/>
            <Link href="/login" style={{ fontWeight: 700 }}>일반 사용자 로그인</Link>
          </div>

        </div>

        {/* 도움말 팝업 (모달) */}
        {helpOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,42,84,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '100%', maxWidth: '340px', background: '#fff', borderRadius: '18px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 40px -12px rgba(20,42,84,.4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557' }}>비밀번호 재발급 안내</span>
                <span style={{ fontSize: '13px', color: '#5A6E8F', lineHeight: 1.6 }}>관리자 계정 비밀번호 재발급은<br/>기숙사 행정실에서 처리합니다.</span>
                <span style={{ marginTop: '4px', fontSize: '19px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-.3px' }}>031-740-7700</span>
                <span style={{ fontSize: '12px', color: '#6B8CB8' }}>평일 09:00 ~ 18:00</span>
              </div>
              <button onClick={() => setHelpOpen(false)} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 700 }}>확인</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 