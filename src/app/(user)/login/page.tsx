'use client';

import { useState, useSyncExternalStore } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { LoginLanguagePicker } from '@/components/language-picker';
import { useT } from '@/lib/i18n/use-t';

/**
 * 이 화면이 띄우는 오류 문구의 key 들. MessageKey 전체가 아니라 여기로 좁히는 이유는,
 * 사전에는 치환 인자를 받는 key 도 있어서 t(아무 key나) 가 타입상 인자를 요구하기
 * 때문이다. 좁혀 두면 t(errorKey) 가 그대로 컴파일되고, 인자가 필요한 key 를 실수로
 * 여기에 넣으면 그 자리에서 잡힌다.
 */
type LoginErrorKey =
  | 'login.failed'
  | 'login.emptyFields'
  | 'login.googleNotSchool'
  | 'login.googleFailed'
  | 'common.networkError';

/**
 * 07 흐름표 · 05 P11 — 어느 쪽이 틀렸는지 알려주지 않는다.
 *
 * auth.ts 의 authorize 가 형식 불량 · 미가입 · 비밀번호 불일치를 전부 같은
 * `return null` 로 묶어 둔 것과 문구를 맞췄다. 화면이 더 자세히 말하면
 * 서버가 숨긴 것(가입 여부)이 화면에서 새어 나간다.
 *
 * **문장이 아니라 key 를 들고 있는다** (Issue #13). 이 화면에는 언어 선택 버튼이
 * 있어서, 오류가 떠 있는 채로 언어를 바꾸는 일이 실제로 일어난다 — 문장을 state 에
 * 담아 두면 그때 옛 언어의 문장이 남는다.
 */
const LOGIN_FAILED: LoginErrorKey = 'login.failed';

/**
 * 학교 계정이 아닌 구글 계정 · 기타 구글 OAuth 실패는 auth.ts의 signIn
 * 콜백/Auth.js가 리다이렉트로 붙이는 ?error= 값으로 온다. 서버에서는 이 쿼리를
 * 알 수 없으므로(빌드 시점 정적 페이지) useSyncExternalStore로 읽어, 서버·
 * 하이드레이션 시점엔 빈 값을 쓰고 하이드레이션이 끝난 뒤에만 실제 쿼리값으로
 * 갈아탄다 — 하이드레이션 불일치 없이 마운트 후 값을 반영할 수 있다.
 * (useSearchParams는 이 페이지에 Suspense 경계를 새로 요구해 범위를 벗어난다.)
 */
const noopSubscribe = () => () => {};
function readOauthError(): LoginErrorKey | '' {
  const error = new URLSearchParams(window.location.search).get('error');
  if (!error) return '';
  if (error === 'not_school_account') return 'login.googleNotSchool';
  return 'login.googleFailed';
}
const readOauthErrorServerSnapshot = (): LoginErrorKey | '' => '';

export default function LoginPage() {
  const t = useT();
  const router = useRouter();

  // --- 로그인 상태 (F38) ---
  //
  // 화면 라벨은 「아이디」지만 서버가 받는 필드 이름은 email 이다
  // (auth.ts 의 credentials · 05 P11 — 아이디가 곧 학교 이메일이다).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 문장이 아니라 key 를 담는다 — 언어를 바꾸면 그 자리에서 함께 바뀐다
  const [errorKey, setErrorKey] = useState<LoginErrorKey | ''>('');
  const [googleOnly, setGoogleOnly] = useState(false);
  // Credentials 로그인 실패(errorKey·googleOnly)와는 발생 경로가 다르므로
  // 상태를 분리해서 섞이지 않게 한다.
  const oauthErrorKey = useSyncExternalStore(noopSubscribe, readOauthError, readOauthErrorServerSnapshot);
  const [pending, setPending] = useState(false);
  // Issue #29 — 「자동 로그인」. 체크(기본값)면 Auth.js 기본 장기 세션(현재 30일)을
  // 그대로 쓰고, 체크 해제하면 세션 쿠키의 Max-Age·Expires만 제거해 브라우저를
  // 완전히 닫으면 사라지는 세션 쿠키로 만든다(src/app/api/auth/[...nextauth]/route.ts).
  // 토큰 값 자체나 세션 길이 정책은 건드리지 않는다.
  const [remember, setRemember] = useState(true);

  /** 입력이 바뀌면 이전 결과를 지운다 — 고친 값에 옛 오류가 붙어 있으면 안 된다. */
  const clearResult = () => {
    setErrorKey('');
    setGoogleOnly(false);
  };

  const handleLogin = async () => {
    if (pending) return;
    clearResult();

    // 서버까지 갈 필요가 없는 것은 빈 값뿐이다. 「무엇이 틀렸다」가 아니라
    // 「아직 보내지 않았다」라서 위의 숨기기 규칙과 부딪치지 않는다.
    if (email.trim() === '' || password === '') {
      setErrorKey('login.emptyFields');
      return;
    }

    setPending(true);
    try {
      // redirect: false 는 호출 자리에 리터럴로 둬야 SignInResponse 오버로드가
      // 잡힌다. 변수로 빼면 redirect 가 boolean 으로 넓어져 반환이 void 가 된다.
      // 비밀번호는 trim 하지 않는다 — 앞뒤 공백도 비밀번호의 일부다.
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        // /api/auth/[...nextauth]/route.ts 의 POST 래퍼가 credentials 콜백
        // 응답에서만 이 값을 읽는다 — 문자열로 보낸다(폼 인코딩이라 boolean이
        // 그대로 넘어가지 않는다).
        remember: remember ? 'true' : 'false',
      });

      // 로그인이 실패해도 res.ok 는 true 다 — @auth/core 가 실패를 status 없이
      // Response.json({ url }) 로 돌려준다(= 200). ok 로 성공을 판정하면
      // 비밀번호가 틀려도 홈으로 들어간다. error 는 실패 시 늘 'CredentialsSignin'
      // 이고, 갈라 보는 값은 code 다 (05 P22).
      if (res?.code === 'google_only') {
        setGoogleOnly(true);
        return;
      }

      if (!res || res.error) {
        setErrorKey(LOGIN_FAILED);
        return;
      }

      router.push('/home');
      router.refresh();
    } catch {
      setErrorKey('common.networkError');
    } finally {
      setPending(false);
    }
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

      {/* `.app-frame-auth` — 이 화면만 내부 스크롤 컨테이너가 없고 세로 가운데 정렬이라
          높이를 고정하지 않는다 ((user)/user-layout.css · Issue #69). */}
      <div className="app-frame-auth" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F8FE 46%, #E4EDFA 100%)' }}>
        
        {/* 상단 장식용 그라데이션 */}
        <div style={{ position: 'absolute', top: '-190px', left: '50%', transform: 'translateX(-50%)', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,147,224,.16) 0%, rgba(91,147,224,0) 62%)', pointerEvents: 'none' }}></div>

        {/* 우측 상단 언어 선택 버튼 (F37 · 05 P25 — 고르는 두 자리 중 하나) */}
        <LoginLanguagePicker />

        {/* 로고 및 타이틀 */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '26px' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '22px', background: '#fff', boxShadow: '0 10px 24px rgba(47,99,184,.14), 0 2px 6px rgba(47,99,184,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'markSettle .8s cubic-bezier(.22,1,.36,1) both' }}>
            <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          </div>
          <div style={{ marginTop: '16px', fontSize: '30px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-1px', lineHeight: 1, animation: 'riseIn .7s cubic-bezier(.22,1,.36,1) .2s both' }}>Washed</div>
          <div style={{ marginTop: '9px', fontSize: '13px', fontWeight: 600, color: '#8FAAD0', letterSpacing: '-.2px', animation: 'riseIn .7s ease-out .32s both' }}>{t('login.tagline')}</div>
        </div>

        {/* 로그인 폼 영역 */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', background: '#fff', borderRadius: '24px', padding: '26px 22px 22px', boxShadow: '0 14px 36px rgba(47,99,184,.12), 0 2px 8px rgba(47,99,184,.05)', animation: 'riseIn .8s cubic-bezier(.22,1,.36,1) .42s both' }}>
          
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#33456B', marginBottom: '8px' }}>{t('login.idLabel')}</label>
          <input
            className="field"
            type="text"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearResult(); }}
            disabled={pending}
            placeholder={t('login.idPlaceholder')}
            style={errorKey ? { borderColor: '#F0A9A4' } : undefined}
          />

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#33456B', margin: '18px 0 8px' }}>{t('login.passwordLabel')}</label>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearResult(); }}
            disabled={pending}
            placeholder={t('login.passwordPlaceholder')}
            style={errorKey ? { borderColor: '#F0A9A4' } : undefined}
          />

          {/* 두 칸을 함께 가리키는 문구라 두 칸 다음에 둔다 (관리자 로그인과 같은 자리). */}
          {errorKey && (
            <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#E0554E', lineHeight: 1.5 }}>{t(errorKey)}</div>
          )}

          {/*
            05 P22 · 07 흐름표 — 비밀번호 칸이 빈 계정은 이메일로 들어올 수 없다.
            08: 「화면은 구글 로그인으로 가는 길을 함께 보여줘야 한다 — 메시지만 띄우면
            사용자가 갈 곳이 없다.」 비밀번호 찾기 화면이 같은 상황을 같은 카드로 처리해서
            모양을 맞췄다. 두 화면이 다르게 말하면 사용자가 다른 문제로 읽는다.
          */}
          {googleOnly && (
            <div style={{ marginTop: '12px', background: '#fff', border: '1px solid #E6EDF7', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E3557', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {t('login.googleOnlyNotice')}
              </span>
              <button type="button" onClick={() => signIn('google', { callbackUrl: '/home' })} style={{ border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}>
                {t('login.googleOnlyButton')}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 500, color: '#5A6E8F', cursor: 'pointer', position: 'relative' }}>
              <input
                className="check"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.3L4.8 8.6L9.5 3.7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </span>
              {t('login.remember')}
            </label>
            <Link href="/password-reset" style={{ fontSize: '13px', fontWeight: 500, color: '#8FAAD0', textDecoration: 'none' }}>{t('login.forgotPassword')}</Link>
          </div>

          <button
            className="primary"
            type="button"
            onClick={handleLogin}
            disabled={pending}
            style={pending ? { opacity: 0.65, cursor: 'default' } : undefined}
          >
            {pending ? t('login.submitting') : t('login.submit')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#EAF0FA' }}></div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#A8BCD9' }}>{t('login.or')}</div>
            <div style={{ flex: 1, height: '1px', background: '#EAF0FA' }}></div>
          </div>

          {oauthErrorKey && (
            <div style={{ marginBottom: '12px', fontSize: '11.5px', color: '#E0554E', lineHeight: 1.5, textAlign: 'center' }}>{t(oauthErrorKey)}</div>
          )}

          <button className="google" type="button" onClick={() => signIn('google', { callbackUrl: '/home' })}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"></path>
              <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"></path>
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"></path>
              <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"></path>
            </svg>
            {t('login.google')}
          </button>
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#A8BCD9', textAlign: 'center', lineHeight: 1.5 }}>{t('login.googleNote')}</div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: '22px', fontSize: '13px', fontWeight: 500, color: '#8FAAD0', animation: 'riseIn .7s ease-out .6s both' }}>
          {t('login.noAccount')} <Link href="/signup" style={{ color: '#2F63B8', fontWeight: 700, textDecoration: 'none', marginLeft: '2px' }}>{t('login.signUp')}</Link>
        </div>

        {/* 언어 설정 팝업 모달은 <LoginLanguagePicker /> 안에 있다 (위 트리거와 한 벌) */}

      </div>
    </>
  );
}