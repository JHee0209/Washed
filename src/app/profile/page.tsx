'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  // --- 상태 관리 ---
  const [name] = useState('주희'); // ⭐️ 이름 고정 (수정 불가)
  const [studentId] = useState('20231234');
  const [room, setRoom] = useState('302호');
  
  // 구글 로그인 여부 상태 (추후 Auth.js 세션 정보와 연동)
  const [isGoogleLogin, setIsGoogleLogin] = useState(true); 
  
  // 비밀번호 관련 상태
  const [currentPw, setCurrentPw] = useState('');
  const [currentPwVisible, setCurrentPwVisible] = useState(false);
  const [currentPwError, setCurrentPwError] = useState(false);
  const [pwVerified, setPwVerified] = useState(false);
  
  const [newPw, setNewPw] = useState('');
  const [newPwVisible, setNewPwVisible] = useState(false);
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [newPwConfirmVisible, setNewPwConfirmVisible] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 테스트용 실제 비밀번호
  const actualPassword = 'washed1234';

  // --- 핸들러 함수 ---
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let digits;
    if (room.endsWith('호') && raw === room.slice(0, -1)) {
      digits = room.slice(0, -1).replace(/[^0-9]/g, '').slice(0, -1);
    } else {
      digits = raw.replace(/[^0-9]/g, '');
    }
    setRoom(digits ? `${digits}호` : '');
  };

  const verifyCurrentPw = () => {
    if (!currentPw.trim()) return;
    if (currentPw === actualPassword) {
      setPwVerified(true);
      setCurrentPwError(false);
    } else {
      setCurrentPwError(true);
    }
  };

  const changePassword = () => {
    if (!newPw || newPw !== newPwConfirm || newPw === currentPw) return;
    showToast('비밀번호가 변경됐어요.');
    setPwVerified(false);
    setCurrentPw('');
    setNewPw('');
    setNewPwConfirm('');
  };

  const handleSave = () => {
    if (!room.trim()) return;
    // 추후 이곳에 DB(Neon) 업데이트 로직이 들어갑니다.
    showToast('프로필이 저장됐어요.');
  };

  // --- 유효성 검사 변수 ---
  const canSave = room.trim() !== ''; // ⭐️ 이름 대신 호실이 비어있지 않은지 검사
  const pwMismatch = newPwConfirm.length > 0 && newPw !== newPwConfirm;
  const pwSameAsOld = newPw.length > 0 && newPw === currentPw;
  const changePwDisabled = !newPw || newPw !== newPwConfirm || newPw === currentPw;

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
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
        html { overflow: hidden; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
        a { color: #2F63B8; text-decoration: none; }
        input { background: #fff; transition: background .18s ease; }
        input:focus { background: #fff; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px' }}>
          <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>프로필 수정</span>
        </div>

        {/* 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '24px 16px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            
            {/* 프로필 이미지 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#B7C6E0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <svg width="76" height="76" viewBox="-7 -5.25 38 38" fill="#fff"><circle cx="12" cy="8.6" r="4.2"></circle><path d="M3.5 22c0-5 3.8-8 8.5-8s8.5 3 8.5 8"></path></svg>
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#5B93E0', cursor: 'default', whiteSpace: 'nowrap' }}>프로필 사진 변경</span>
            </div>

            {/* ⭐️ 기본 정보 폼 (이름 고정 처리) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>이름</label>
              <input value={name} disabled style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#8FAAD0', background: '#F3F6FB' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>학번</label>
              <input value={studentId} disabled style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#8FAAD0', background: '#F3F6FB' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>호실</label>
              <input value={room} onChange={handleRoomChange} placeholder="호실을 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#1E3557' }} />
            </div>

            <div style={{ height: '1px', background: '#E1E8F2', margin: '4px 0' }}></div>

            {/* 비밀번호 변경 영역 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>비밀번호 변경</span>

              {/* 구글 로그인 유저 예외 처리 */}
              {isGoogleLogin ? (
                <div style={{ padding: '16px', background: '#F6F9FE', borderRadius: '12px', border: '1px solid #E6EDF7', textAlign: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#5A7CA8', lineHeight: 1.5 }}>
                    학교 구글 계정으로 가입된 계정입니다.<br/>비밀번호 관리는 구글 계정 설정에서 가능합니다.
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>현재 비밀번호</label>
                    <div style={{ position: 'relative' }}>
                      <input type={currentPwVisible ? 'text' : 'password'} value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setCurrentPwError(false); }} placeholder="현재 비밀번호를 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: `inset 0 0 0 1px ${currentPwError ? '#E0554E' : '#E6EDF7'}`, padding: '13px 40px 13px 14px', fontSize: '14px', color: '#1E3557' }} />
                      {currentPw.length > 0 && (
                        <button type="button" onClick={() => setCurrentPwVisible(!currentPwVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={currentPwVisible} /></button>
                      )}
                    </div>
                    {currentPwError && <span style={{ fontSize: '12px', color: '#E0554E' }}>현재 비밀번호가 올바르지 않아요</span>}
                  </div>

                  {pwVerified ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>새 비밀번호</label>
                        <div style={{ position: 'relative' }}>
                          <input type={newPwVisible ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호를 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 40px 13px 14px', fontSize: '14px', color: '#1E3557' }} />
                          {newPw.length > 0 && <button type="button" onClick={() => setNewPwVisible(!newPwVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={newPwVisible} /></button>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>새 비밀번호 확인</label>
                        <div style={{ position: 'relative' }}>
                          <input type={newPwConfirmVisible ? 'text' : 'password'} value={newPwConfirm} onChange={(e) => setNewPwConfirm(e.target.value)} placeholder="새 비밀번호를 다시 입력해 주세요" style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 40px 13px 14px', fontSize: '14px', color: '#1E3557' }} />
                          {newPwConfirm.length > 0 && <button type="button" onClick={() => setNewPwConfirmVisible(!newPwConfirmVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={newPwConfirmVisible} /></button>}
                        </div>
                        {pwMismatch && <span style={{ fontSize: '12px', color: '#E0554E' }}>비밀번호가 일치하지 않아요</span>}
                        {pwSameAsOld && <span style={{ fontSize: '12px', color: '#E0554E' }}>현재 비밀번호와 동일합니다</span>}
                      </div>

                      <button onClick={changePassword} disabled={changePwDisabled} style={{ border: 'none', cursor: changePwDisabled ? 'default' : 'pointer', color: changePwDisabled ? '#C3D2E6' : '#4C86D8', background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${changePwDisabled ? '#E6EDF7' : '#4C86D8'}`, borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}>
                        비밀번호 변경
                      </button>
                    </>
                  ) : (
                    <button onClick={verifyCurrentPw} disabled={!currentPw.trim()} style={{ border: 'none', cursor: currentPw.trim() ? 'pointer' : 'default', color: currentPw.trim() ? '#4C86D8' : '#C3D2E6', background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${currentPw.trim() ? '#4C86D8' : '#E6EDF7'}`, borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}>
                      확인
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 하단 저장 버튼 */}
            <button onClick={handleSave} disabled={!canSave} style={{ border: 'none', cursor: canSave ? 'pointer' : 'default', color: canSave ? '#fff' : '#A8BCD9', background: canSave ? '#4C86D8' : '#EDF2FA', borderRadius: '12px', padding: '14px', fontSize: '14.5px', fontWeight: 700 }}>
              저장하기
            </button>
          </div>
        </div>

        {/* 토스트 알림 */}
        {toastVisible && (
          <div style={{ position: 'absolute', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 110, background: '#17233C', color: '#EEF4FD', borderRadius: '14px', padding: '11px 17px', fontSize: '12.5px', fontWeight: 600, boxShadow: '0 4px 12px rgba(20,42,84,.22)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '88%' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#5BD39A', flexShrink: 0 }}></div>
            <span>{toastMessage}</span>
          </div>
        )}

      </div>
    </>
  );
}