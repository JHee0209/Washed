'use client';

// 문의하기 화면 본체 (F21 · Issue #86).
//
// 예전에는 「문의 보내기」가 setSent(true) 만 불러서 **아무 데도 보내지 않고** 성공
// 화면으로 넘어갔다. 이제 /api/support 로 보내고, **성공했을 때만** 접수 화면으로 바꾼다.
//
// 이름 · 아이디(이메일)는 서버(page.tsx 의 requireMe())에서 내려온 값이라 읽기 전용이다.
// 보내는 것은 content 하나뿐이고, 누구의 문의인지는 서버가 세션으로 정한다.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useApiError, useT } from '@/lib/i18n/use-t';
import { MAX_INQUIRY_LENGTH } from '@/lib/inquiry-rules';

export default function SupportClient({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const t = useT();
  const apiError = useApiError();

  // --- 상태 관리 ---
  const [content, setContent] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- 유효성 검사 (서버도 inquiry-rules.ts 의 같은 조건을 다시 본다) ---
  const canSubmit = content.trim() !== '' && !submitting;

  // --- 핸들러 함수 ---
  const handleSubmit = async () => {
    // 중복 클릭 방지 — 응답이 오기 전에 또 누르면 문의가 두 건 쌓인다.
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !data?.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        // **실패했는데 접수 화면으로 바뀌면 안 된다** — 여기서 끝낸다.
        setError(apiError(data, t('support.failed')));
        return;
      }

      setSent(true);
    } catch {
      setError(t('support.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const readOnlyInput: React.CSSProperties = {
    width: '100%',
    border: 'none',
    outline: 'none',
    borderRadius: '12px',
    boxShadow: 'inset 0 0 0 1px #E6EDF7',
    padding: '13px 14px',
    fontSize: '14px',
    color: '#5A7CA8',
    background: '#F1F5FC',
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

      <div className="app-frame" style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden' }}>

        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px 12px', paddingTop: 'max(14px, env(safe-area-inset-top))', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '100%' }}>
          <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>{t('support.title')}</span>
        </div>

        {/* ⭐️ 문의 접수 완료 화면 (sent가 true일 때 표시) */}
        {sent ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 30px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9.5 18 20 6" stroke="#188A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E3557' }}>{t('support.sentTitle')}</div>
            {/* 줄바꿈은 번역문의 `\n` 이 정한다 — <br/> 를 쓰던 자리와 보이는 결과는 같다 */}
            <div style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t('support.sentBody')}</div>
            <Link href="/settings" style={{ marginTop: '10px', background: '#4C86D8', color: '#fff', borderRadius: '12px', padding: '11px 22px', fontSize: '13.5px', fontWeight: 700 }}>
              {t('support.backToSettings')}
            </Link>
          </div>
        ) : (
          /* ⭐️ 문의 입력 폼 화면 (sent가 false일 때 표시) */
          <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t('support.intro')}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('field.name')}</label>
                {/* 값(name · email)은 서버에서 내려온 사용자 정보다 — 번역하지 않는다 (05 P25) */}
                <input value={name} readOnly style={readOnlyInput} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('support.emailLabel')}</label>
                <input value={email} readOnly style={readOnlyInput} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#5A7CA8' }}>{t('support.contentLabel')}</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={MAX_INQUIRY_LENGTH} placeholder={t('support.contentPlaceholder')} style={{ width: '100%', border: 'none', outline: 'none', borderRadius: '12px', boxShadow: 'inset 0 0 0 1px #E6EDF7', padding: '13px 14px', fontSize: '14px', color: '#1E3557', background: '#fff', resize: 'none', minHeight: '140px', fontFamily: 'inherit', lineHeight: 1.5 }}></textarea>
              </div>

              {error && (
                <div role="alert" style={{ fontSize: '12.5px', color: '#C2453E', lineHeight: 1.5 }}>{error}</div>
              )}

              <button onClick={handleSubmit} disabled={!canSubmit} style={{ border: 'none', cursor: canSubmit ? 'pointer' : 'default', color: canSubmit ? '#fff' : '#A8BCD9', background: canSubmit ? '#4C86D8' : '#EDF2FA', borderRadius: '12px', padding: '14px', fontSize: '14.5px', fontWeight: 700 }}>
                {submitting ? t('support.submitting') : t('support.submit')}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
