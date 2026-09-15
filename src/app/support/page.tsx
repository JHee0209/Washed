'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SupportPage() {
  // --- 상태 관리 ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [sent, setSent] = useState(false);

  // --- 유효성 검사 ---
  const canSubmit = name.trim() !== '' && email.trim() !== '' && content.trim() !== '';

  // --- 핸들러 함수 ---
  const handleSubmit = () => {
    if (canSubmit) {
      // 추후 여기에 백엔드로 문의 내용을 전송하는 API 코드가 추가됩니다.
      setSent(true);
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
        input, textarea { background: #F6F9FE; transition: background .18s ease, box-shadow .18s ease; }
        input:focus, textarea:focus { background: #fff; }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px' }}>
          <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>문의하기</span>
        </div>

        {/* ⭐️ 문의 접수 완료 화면 (sent가 true일 때 표시) */}
        {sent ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 30px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9.5 18 20 6" stroke="#188A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E3557' }}>문의가 접수됐어요</div>
            <div style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>관리자가 확인 후 입력하신 아이디로<br/>답변을 드릴게요.</div>
            <Link href="/settings" style={{ marginTop: '10px', background: '#4C86D8', color: '#fff', borderRadius: '12px', padding: '11px 22px', fontSize: '13.5px', fontWeight: 700 }}>
              설정으로 돌아가기
            </Link>
          </div>
        ) : (
          /* ⭐️ 문의 입력 폼 화면 (sent가 false일 때 표시) */
          <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>궁금한 점이나 문제가 있으면 남겨주세요.<br/>입력하신 아이디(이메일)로 답변을 보내드려요.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>이름</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#1E3557', background: '#fff' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>아이디(이메일)</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="답변 받을 이메일을 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#1E3557', background: '#fff' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>내용</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="문의하실 내용을 자세히 적어주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#1E3557', background: '#fff', resize: 'none', minHeight: '140px', fontFamily: 'inherit', lineHeight: 1.5 }}></textarea>
              </div>

              <button onClick={handleSubmit} disabled={!canSubmit} style={{ border: 'none', cursor: canSubmit ? 'pointer' : 'default', color: canSubmit ? '#fff' : '#A8BCD9', background: canSubmit ? '#4C86D8' : '#EDF2FA', borderRadius: '12px', padding: '14px', fontSize: '14.5px', fontWeight: 700 }}>
                문의 보내기
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}