'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from '@/components/profile-avatar';
import {
  MAX_PROFILE_PHOTO_BYTES,
  MAX_PROFILE_PHOTO_LABEL,
  isAllowedProfilePhotoMime,
} from '@/lib/profile-photo-rules';
import { useT } from '@/lib/i18n/use-t';
import { changePassword as changePasswordAction, verifyCurrentPassword } from '@/lib/user-actions';

type ProfileClientProps = {
  name: string;
  studentId: string;
  room: string;
  hasPassword: boolean;
};

export default function ProfileClient({ name, studentId, room: initialRoom, hasPassword }: ProfileClientProps) {
  const t = useT();
  // --- 상태 관리 ---
  const [room, setRoom] = useState(initialRoom);

  // 05 — 비밀번호 칸이 비어 있는지로 구글 가입자를 가린다("가입 방식" 이 아니라
  // "비밀번호 칸이 비었는지"). requireMe() 의 hasPassword 가 그 값이다.
  const [isGoogleLogin] = useState(!hasPassword);

  // 비밀번호 관련 상태
  const [currentPw, setCurrentPw] = useState('');
  const [currentPwVisible, setCurrentPwVisible] = useState(false);
  const [currentPwError, setCurrentPwError] = useState(false);
  const [pwVerified, setPwVerified] = useState(false);

  const [newPw, setNewPw] = useState('');
  const [newPwVisible, setNewPwVisible] = useState(false);
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [newPwConfirmVisible, setNewPwConfirmVisible] = useState(false);

  // Issue #84 — 1단계("확인")·2단계("비밀번호 변경") 각각 서버 액션이 진행
  // 중일 때 중복 클릭을 막는다. pwVerified 는 화면 상태일 뿐이고, 실제 변경은
  // changePassword() 안에서 다시 검증하므로 이 플래그가 그 검증을 대신하지 않는다.
  const [pwVerifying, setPwVerifying] = useState(false);
  const [pwChanging, setPwChanging] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Issue #76 — 프로필 사진. photoPreviewUrl 이 있으면 "선택했지만 아직 저장
  // 전"이고, 저장이 끝나면 비우고 photoVersion 을 올려 ProfileAvatar 가 서버의
  // 실제 사진을 다시 받아오게 한다(낙관적으로 미리보기를 그대로 "저장됨"으로
  // 두지 않는다 — 서버 저장이 실제로 성공했는지 GET 으로 다시 확인한다).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photoSaving, setPhotoSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Issue #84 — "기본 이미지로 되돌리기" 버튼을 사진이 있을 때만 보여주려면
  // 저장된 사진이 있는지 알아야 한다. ProfileAvatar 는 그 상태를 내부에만
  // 갖고 있어(onError 로만 판정) 밖에서 알 수 없으므로, 여기서만 따로 한 번
  // 확인한다(마운트 시 1회) — ProfileAvatar 자체는 고치지 않는다.
  // null = 아직 확인 전(그동안 되돌리기 버튼을 보이지 않는다).
  const [hasSavedPhoto, setHasSavedPhoto] = useState<boolean | null>(null);
  const [photoResetting, setPhotoResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/photo', { cache: 'no-store' })
      .then((res) => {
        if (!cancelled) setHasSavedPhoto(res.ok);
      })
      .catch(() => {
        if (!cancelled) setHasSavedPhoto(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // object URL 은 명시적으로 풀어 줘야 한다 — 다른 파일을 고르거나 화면을
  // 떠날 때 남아 있으면 탭이 닫힐 때까지 메모리에 붙어 있는다.
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // --- 핸들러 함수 ---
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 onChange 가 다시 뜨게 한다
    if (!file) return;

    // 클라이언트 쪽 확인은 친절을 위한 것일 뿐이다 — 실제 판정(매직 넘버까지)은
    // 서버(/api/profile/photo)가 한다.
    if (!isAllowedProfilePhotoMime(file.type)) {
      showToast(t('common.imageTypeOnly'));
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      showToast(t('profile.photoTooLarge', { limit: MAX_PROFILE_PHOTO_LABEL }));
      return;
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const cancelPhotoSelection = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  const savePhoto = async () => {
    if (!photoFile || photoSaving) return;
    setPhotoSaving(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const res = await fetch('/api/profile/photo', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? t('profile.photoSaveFailed'));
      }
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setPhotoVersion((v) => v + 1);
      setHasSavedPhoto(true);
      showToast(t('profile.photoSaved'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('profile.photoSaveFailed'));
    } finally {
      setPhotoSaving(false);
    }
  };

  // Issue #84 — 등록한 사진을 지우고 기본 이미지로 되돌린다. DELETE 는
  // idempotent(이미 없어도 성공)라 여기서 "정말 있는지"를 먼저 확인하지 않고
  // 그냥 부른다 — 실패는 네트워크/서버 오류일 때뿐이다.
  const resetPhoto = async () => {
    if (photoResetting) return;
    setPhotoResetting(true);
    try {
      const res = await fetch('/api/profile/photo', { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? t('profile.photoResetFailed'));
      }
      setHasSavedPhoto(false);
      setPhotoVersion((v) => v + 1);
      showToast(t('profile.photoResetDone'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('profile.photoResetFailed'));
    } finally {
      setPhotoResetting(false);
    }
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

  // Issue #84 — 실제 서버(users.password_hash)를 기준으로 확인한다. 이 결과는
  // "새 비밀번호 입력 칸을 보여줄지"만 정할 뿐, 실제 변경은 changePassword() 가
  // 다시 독립적으로 검증한다 — 이 단계를 건너뛰거나 결과를 조작해도 저장은
  // 되지 않는다.
  const verifyCurrentPw = async () => {
    if (!currentPw.trim() || pwVerifying) return;
    setPwVerifying(true);
    try {
      const result = await verifyCurrentPassword(currentPw);
      if (result.ok) {
        setPwVerified(true);
        setCurrentPwError(false);
      } else {
        setCurrentPwError(true);
      }
    } catch {
      setCurrentPwError(true);
    } finally {
      setPwVerifying(false);
    }
  };

  const changePassword = async () => {
    if (changePwDisabled || pwChanging) return;
    setPwChanging(true);
    try {
      const result = await changePasswordAction(currentPw, newPw);
      if (result.ok) {
        showToast(t('profile.pwChanged'));
        setPwVerified(false);
        setCurrentPw('');
        setNewPw('');
        setNewPwConfirm('');
      } else {
        if (result.field === 'current') {
          // 검증 사이에 비밀번호가 바뀌었거나 애초에 틀렸다 — 1단계부터 다시.
          setPwVerified(false);
          setCurrentPwError(true);
        }
        showToast(result.message);
      }
    } catch {
      showToast(t('profile.pwChangeFailed'));
    } finally {
      setPwChanging(false);
    }
  };

  const handleSave = () => {
    if (!room.trim()) return;
    // 추후 이곳에 DB(Neon) 업데이트 로직이 들어갑니다.
    showToast(t('profile.saved'));
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
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>{t('profile.title')}</span>
        </div>

        {/* 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '24px 16px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

            {/* 프로필 이미지 (Issue #76) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              {photoPreviewUrl ? (
                <div style={{ width: '76px', height: '76px', borderRadius: '50%', overflow: 'hidden', background: '#B7C6E0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreviewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <ProfileAvatar size={76} version={photoVersion} />
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />

              {photoPreviewUrl ? (
                <div style={{ display: 'flex', gap: '14px' }}>
                  <button
                    type="button"
                    onClick={savePhoto}
                    disabled={photoSaving}
                    style={{ border: 'none', background: 'transparent', cursor: photoSaving ? 'default' : 'pointer', color: photoSaving ? '#A8BCD9' : '#4C86D8', fontSize: '12.5px', fontWeight: 700, padding: 0 }}
                  >
                    {photoSaving ? t('profile.photoSaving') : t('profile.photoSave')}
                  </button>
                  <button
                    type="button"
                    onClick={cancelPhotoSelection}
                    disabled={photoSaving}
                    style={{ border: 'none', background: 'transparent', cursor: photoSaving ? 'default' : 'pointer', color: '#8FAAD0', fontSize: '12.5px', fontWeight: 600, padding: 0 }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '14px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5B93E0', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', padding: 0 }}
                  >
                    {t('profile.photoChange')}
                  </button>
                  {/* Issue #84 — 저장된 사진이 있을 때만 보여준다(hasSavedPhoto 가
                      아직 확인 전(null)이거나 사진이 없으면 숨긴다). */}
                  {hasSavedPhoto === true && (
                    <button
                      type="button"
                      onClick={resetPhoto}
                      disabled={photoResetting}
                      style={{ border: 'none', background: 'transparent', cursor: photoResetting ? 'default' : 'pointer', color: photoResetting ? '#C3D2E6' : '#8FAAD0', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', padding: 0 }}
                    >
                      {photoResetting ? t('profile.photoResetting') : t('profile.photoReset')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ⭐️ 기본 정보 폼 (이름 고정 처리) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.name')}</label>
              <input value={name} disabled style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#8FAAD0', background: '#F3F6FB' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.studentId')}</label>
              <input value={studentId} disabled style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#8FAAD0', background: '#F3F6FB' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.room')}</label>
              <input value={room} onChange={handleRoomChange} placeholder={t('profile.roomPlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#1E3557' }} />
            </div>

            <div style={{ height: '1px', background: '#E1E8F2', margin: '4px 0' }}></div>

            {/* 비밀번호 변경 영역 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>{t('profile.passwordChange')}</span>

              {/* 구글 로그인 유저 예외 처리 */}
              {isGoogleLogin ? (
                <div style={{ padding: '16px', background: '#F6F9FE', borderRadius: '12px', border: '1px solid #E6EDF7', textAlign: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#5A7CA8', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {t('profile.googleNotice')}
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('profile.currentPw')}</label>
                    <div style={{ position: 'relative' }}>
                      <input type={currentPwVisible ? 'text' : 'password'} value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setCurrentPwError(false); }} placeholder={t('profile.currentPwPlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: `inset 0 0 0 1px ${currentPwError ? '#E0554E' : '#E6EDF7'}`, padding: '13px 40px 13px 14px', fontSize: '14px', color: '#1E3557' }} />
                      {currentPw.length > 0 && (
                        <button type="button" onClick={() => setCurrentPwVisible(!currentPwVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={currentPwVisible} /></button>
                      )}
                    </div>
                    {currentPwError && <span style={{ fontSize: '12px', color: '#E0554E' }}>{t('profile.currentPwWrong')}</span>}
                  </div>

                  {pwVerified ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('profile.newPw')}</label>
                        <div style={{ position: 'relative' }}>
                          <input type={newPwVisible ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('profile.newPwPlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 40px 13px 14px', fontSize: '14px', color: '#1E3557' }} />
                          {newPw.length > 0 && <button type="button" onClick={() => setNewPwVisible(!newPwVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={newPwVisible} /></button>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('profile.newPwConfirm')}</label>
                        <div style={{ position: 'relative' }}>
                          <input type={newPwConfirmVisible ? 'text' : 'password'} value={newPwConfirm} onChange={(e) => setNewPwConfirm(e.target.value)} placeholder={t('profile.newPwConfirmPlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 40px 13px 14px', fontSize: '14px', color: '#1E3557' }} />
                          {newPwConfirm.length > 0 && <button type="button" onClick={() => setNewPwConfirmVisible(!newPwConfirmVisible)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FAAD0' }}><EyeIcon open={newPwConfirmVisible} /></button>}
                        </div>
                        {pwMismatch && <span style={{ fontSize: '12px', color: '#E0554E' }}>{t('profile.pwMismatch')}</span>}
                        {pwSameAsOld && <span style={{ fontSize: '12px', color: '#E0554E' }}>{t('profile.pwSameAsOld')}</span>}
                      </div>

                      <button onClick={changePassword} disabled={changePwDisabled || pwChanging} style={{ border: 'none', cursor: (changePwDisabled || pwChanging) ? 'default' : 'pointer', color: (changePwDisabled || pwChanging) ? '#C3D2E6' : '#4C86D8', background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${(changePwDisabled || pwChanging) ? '#E6EDF7' : '#4C86D8'}`, borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}>
                        {pwChanging ? t('profile.changing') : t('profile.passwordChange')}
                      </button>
                    </>
                  ) : (
                    <button onClick={verifyCurrentPw} disabled={!currentPw.trim() || pwVerifying} style={{ border: 'none', cursor: (currentPw.trim() && !pwVerifying) ? 'pointer' : 'default', color: (currentPw.trim() && !pwVerifying) ? '#4C86D8' : '#C3D2E6', background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${(currentPw.trim() && !pwVerifying) ? '#4C86D8' : '#E6EDF7'}`, borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}>
                      {pwVerifying ? t('profile.verifying') : t('common.confirm')}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 하단 저장 버튼 */}
            <button onClick={handleSave} disabled={!canSave} style={{ border: 'none', cursor: canSave ? 'pointer' : 'default', color: canSave ? '#fff' : '#A8BCD9', background: canSave ? '#4C86D8' : '#EDF2FA', borderRadius: '12px', padding: '14px', fontSize: '14.5px', fontWeight: 700 }}>
              {t('common.save')}
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
