'use client'; // 타이머와 화면 이동을 위해 클라이언트 컴포넌트로 선언!

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();

  // 💡 마법의 3초 타이머 코드
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login'); // 3초(3000ms) 뒤에 로그인 페이지로 자동 이동
    }, 3000);

    return () => clearTimeout(timer); // 화면이 넘어가면 타이머를 깔끔하게 청소해 줍니다
  }, [router]);

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Malgun Gothic', sans-serif; box-sizing: border-box; }

        @keyframes markSettle { 0% { opacity: 0; transform: scale(.86) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes glowIn { 0% { opacity: 0; transform: scale(.7) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes ringIn { 0% { opacity: 0 } 100% { opacity: 1 } }
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
        @keyframes tagIn { 0% { opacity: 0; letter-spacing: 5.5px } 100% { opacity: 1; letter-spacing: 2.4px } }
        @keyframes bubbleRise { 0% { transform: translateY(0); opacity: 0 } 12% { opacity: 1 } 85% { opacity: 1 } 100% { transform: translateY(-940px); opacity: 0 } }
        @keyframes bubbleSway { 0% { transform: translateX(0) } 50% { transform: translateX(14px) } 100% { transform: translateX(0) } }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: .01ms !important; animation-iteration-count: 1 !important }
        }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F8FE 46%, #E4EDFA 100%)', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        <div style={{ position: 'absolute', top: '-170px', left: '50%', transform: 'translateX(-50%)', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,147,224,.16) 0%, rgba(91,147,224,0) 62%)', pointerEvents: 'none' }}></div>

        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: '44px', bottom: '-40px', animation: 'bubbleRise 17s linear infinite 0.0s' }}><div style={{ position: 'relative', width: '21px', height: '21px', borderRadius: '50%', border: '1.5px solid rgba(91,147,224,0.38)', background: 'rgba(91,147,224,.06)', animation: 'bubbleSway 7.0s ease-in-out infinite' }}><div style={{ position: 'absolute', top: '5px', left: '4px', width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(91,147,224,.30)' }}></div></div></div>
          <div style={{ position: 'absolute', left: '108px', bottom: '-40px', animation: 'bubbleRise 13s linear infinite 3.4s' }}><div style={{ position: 'relative', width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(91,147,224,0.3)', background: 'rgba(91,147,224,.06)', animation: 'bubbleSway 5.5s ease-in-out infinite' }}></div></div>
          <div style={{ position: 'absolute', left: '176px', bottom: '-40px', animation: 'bubbleRise 20s linear infinite 6.2s' }}><div style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid rgba(91,147,224,0.26)', background: 'rgba(91,147,224,.06)', animation: 'bubbleSway 8.5s ease-in-out infinite' }}><div style={{ position: 'absolute', top: '6px', left: '6px', width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(91,147,224,.30)' }}></div></div></div>
          <div style={{ position: 'absolute', left: '250px', bottom: '-40px', animation: 'bubbleRise 15s linear infinite 1.8s' }}><div style={{ position: 'relative', width: '15px', height: '15px', borderRadius: '50%', border: '1.5px solid rgba(91,147,224,0.34)', background: 'rgba(91,147,224,.06)', animation: 'bubbleSway 6.5s ease-in-out infinite' }}></div></div>
          <div style={{ position: 'absolute', left: '318px', bottom: '-40px', animation: 'bubbleRise 12s linear infinite 8.0s' }}><div style={{ position: 'relative', width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid rgba(91,147,224,0.3)', background: 'rgba(91,147,224,.06)', animation: 'bubbleSway 5.0s ease-in-out infinite' }}></div></div>
          <div style={{ position: 'absolute', left: '352px', bottom: '-40px', animation: 'bubbleRise 18s linear infinite 4.6s' }}><div style={{ position: 'relative', width: '19px', height: '19px', borderRadius: '50%', border: '1.5px solid rgba(91,147,224,0.24)', background: 'rgba(91,147,224,.06)', animation: 'bubbleSway 7.5s ease-in-out infinite' }}><div style={{ position: 'absolute', top: '4px', left: '4px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(91,147,224,.30)' }}></div></div></div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '196px', height: '196px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, animation: 'ringIn .5s ease-out .5s both' }}>
            <svg width="196" height="196" viewBox="0 0 196 196" style={{ display: 'block', animation: 'spin 2.4s linear infinite' }}>
              <circle cx="98" cy="98" r="94" fill="none" stroke="rgba(91,147,224,.14)" strokeWidth="2"></circle>
              <circle cx="98" cy="98" r="94" fill="none" stroke="#5B93E0" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="92 498" opacity=".85"></circle>
            </svg>
          </div>
          <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '40px', background: 'rgba(91,147,224,.20)', filter: 'blur(26px)', animation: 'glowIn 1s ease-out both' }}></div>
          <div style={{ position: 'relative', width: '132px', height: '132px', borderRadius: '36px', background: '#fff', boxShadow: '0 14px 32px rgba(47,99,184,.14), 0 2px 6px rgba(47,99,184,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'markSettle .8s cubic-bezier(.22,1,.36,1) both' }}>
            <img src="/icons/logo-mark.png" alt="Washed Logo" style={{ width: '86px', height: '86px', objectFit: 'contain' }} />
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: '34px', fontSize: '37px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-1.4px', lineHeight: 1, animation: 'riseIn .7s cubic-bezier(.22,1,.36,1) .45s both' }}>
          Washed
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: '14px', fontSize: '11px', fontWeight: 700, color: '#93AFD6', letterSpacing: '2.4px', textTransform: 'uppercase', animation: 'tagIn .8s ease-out .8s both' }}>
          Cleaner · Easier · Together
        </div>

        {/* ⭐️ 원래 디자인에 있던 문구로 복구! */}
        <div style={{ position: 'absolute', zIndex: 1, bottom: '56px', fontSize: '12px', fontWeight: 500, color: '#A8BCD9', animation: 'riseIn .7s ease-out 1.15s both' }}>
          세탁실 상태를 불러오는 중...
        </div>

      </div>
    </>
  );
}