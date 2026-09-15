'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function LoginPage() {
  // ⭐️ 언어 설정 관련 상태
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('ko');

  const langMap: Record<string, { label: string, icon: string }> = {
    ko: { label: '한국어', icon: '/icons/flag-kr.png' },
    en: { label: 'English', icon: '/icons/flag-en.png' },
    zh: { label: '中文', icon: '/icons/flag-zh.png' },
    ja: { label: '日本語', icon: 'https://flagcdn.com/w40/jp.png' } 
  };

  return (
    <>
      <style>{`
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
        @keyframes markSettle { 0% { opacity: 0; transform: scale(.86) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: scale(1) } }
        
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Malgun Gothic', sans-serif; box-sizing: border-box; }
        
        .field { width: 100%; height: 52px; padding: 0 16px; border-radius: 14px; border: 1.5px solid #E3EBF7; background: #F6F9FE; font-size: 15px; font-weight: 500; color: #1E3557; transition: border-color .18s ease, background .18s ease, box-shadow .18s ease; }
        .field::placeholder { color: #A8BCD9; font-weight: 400; }
        .field:focus { outline: none; border-color: #5B93E0; background: #fff; box-shadow: 0 0 0 4px rgba(91, 147, 224, .14); }
        
        .primary { width: 100%; height: 54px; border: 0; border-radius: 14px; cursor: pointer; background: linear-gradient(180deg, #5B93E0 0%, #3B76CC 100%); color: #fff; font-size: 16px; font-weight: 700; letter-spacing: -.2px; box-shadow: 0 8px 20px rgba(47, 99, 184, .28); transition: transform .12s ease, box-shadow .18s ease; }
        .primary:active { transform: translateY(1px); box-shadow: 0 4px 12px rgba(47, 99, 184, .24); }
        
        .google { width: 100%; height: 52px; border: 1.5px solid #E3EBF7; border-radius: 14px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 15px; font-weight: 600; color: #33456B; transition: background .18s ease, border-color .18s ease; }
        .google:active { background: #F6F9FE; border-color: #CFDDF2; }
        
        .check { position: absolute; opacity: 0; width: 0; height: 0; }
        .check + span { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #CFDDF2; background: #fff; display: inline-flex; align-items: center; justify-content: center; flex: none; transition: all .15s ease; }
        .check + span svg { opacity: 0; transition: opacity .15s ease; }
        .check:checked + span { background: #5B93E0; border-color: #5B93E0; }
        .check:checked + span svg { opacity: 1; }
        .check:focus-visible + span { box-shadow: 0 0 0 4px rgba(91, 147, 224, .18); }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F8FE 46%, #E4EDFA 100%)', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 상단 장식용 그라데이션 */}
        <div style={{ position: 'absolute', top: '-190px', left: '50%', transform: 'translateX(-50%)', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,147,224,.16) 0%, rgba(91,147,224,0) 62%)', pointerEvents: 'none' }}></div>

        {/* ⭐️ 우측 상단 언어 선택 버튼 */}
        <div onClick={() => setLangOpen(true)} style={{ position: 'absolute', top: '58px', right: '20px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid #E3EBF7', padding: '6px 10px', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(47,99,184,.08)' }}>
          <img src={langMap[currentLang].icon} alt={langMap[currentLang].label} style={{ width: '20px', height: '14px', borderRadius: '3px', boxShadow: '0 0 0 1px rgba(47,99,184,.14)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#33456B' }}>{langMap[currentLang].label}</span>
          <svg width="10" height="6" viewBox="0 0 12 8" fill="none" style={{ marginLeft: '2px' }}><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#5B93E0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
        </div>

        {/* 로고 및 타이틀 */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '26px' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '22px', background: '#fff', boxShadow: '0 10px 24px rgba(47,99,184,.14), 0 2px 6px rgba(47,99,184,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'markSettle .8s cubic-bezier(.22,1,.36,1) both' }}>
            <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          </div>
          <div style={{ marginTop: '16px', fontSize: '30px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-1px', lineHeight: 1, animation: 'riseIn .7s cubic-bezier(.22,1,.36,1) .2s both' }}>Washed</div>
          <div style={{ marginTop: '9px', fontSize: '13px', fontWeight: 600, color: '#8FAAD0', letterSpacing: '-.2px', animation: 'riseIn .7s ease-out .32s both' }}>세탁기 · 건조기 원격 줄서기</div>
        </div>

        {/* 로그인 폼 영역 */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', background: '#fff', borderRadius: '24px', padding: '26px 22px 22px', boxShadow: '0 14px 36px rgba(47,99,184,.12), 0 2px 8px rgba(47,99,184,.05)', animation: 'riseIn .8s cubic-bezier(.22,1,.36,1) .42s both' }}>
          
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#33456B', marginBottom: '8px' }}>아이디</label>
          <input className="field" type="text" placeholder="아이디를 입력해 주세요" />

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#33456B', margin: '18px 0 8px' }}>비밀번호</label>
          <input className="field" type="password" placeholder="비밀번호를 입력해 주세요" />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 500, color: '#5A6E8F', cursor: 'pointer', position: 'relative' }}>
              <input className="check" type="checkbox" defaultChecked />
              <span>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.3L4.8 8.6L9.5 3.7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </span>
              자동 로그인
            </label>
            <Link href="/password-reset" style={{ fontSize: '13px', fontWeight: 500, color: '#8FAAD0', textDecoration: 'none' }}>비밀번호 찾기</Link>
          </div>

          <button className="primary" type="button">로그인</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#EAF0FA' }}></div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#A8BCD9' }}>또는</div>
            <div style={{ flex: 1, height: '1px', background: '#EAF0FA' }}></div>
          </div>

          <button className="google" type="button" onClick={() => signIn('google', { callbackUrl: '/home' })}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"></path>
              <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"></path>
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"></path>
              <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"></path>
            </svg>
            학교 구글 계정으로 계속하기
          </button>
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#A8BCD9', textAlign: 'center', lineHeight: 1.5 }}>학교 이메일(@school.ac.kr) 구글 계정만 이용할 수 있어요</div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: '22px', fontSize: '13px', fontWeight: 500, color: '#8FAAD0', animation: 'riseIn .7s ease-out .6s both' }}>
          아직 계정이 없나요? <Link href="/signup" style={{ color: '#2F63B8', fontWeight: 700, textDecoration: 'none', marginLeft: '2px' }}>회원가입</Link>
        </div>

        {/* ⭐️ 언어 설정 팝업 모달 */}
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

      </div>
    </>
  );
}