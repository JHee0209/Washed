'use client';

// 언어 선택 UI 한 벌 (F37 · 05 P25 · Issue #13 의 7번).
//
// ── 이 파일이 하는 일과 하지 않는 일
// 전에는 로그인 화면과 설정 화면이 **각자 복사한 langMap 과 모달**을 들고 있었고,
// 고른 값은 useState 에만 남아 아무것도 번역되지 않았다(07 흐름표의 [?] 그대로).
// 여기 하나로 합치고 store.ts 의 setLang 에 연결한다.
//
// **디자인은 바꾸지 않는다.** 아래 마크업과 style 값은 옮겨 오기 전 두 화면의
// 인라인 코드 그대로다 — 위치 · 크기 · 색 · 애니메이션 · 여는 방식이 전과 같다.
// 이번 Issue 는 「언어 설정 UI 를 새로 만드는 것」이 아니라 「있던 UI 를 실제
// 번역 시스템에 연결하는 것」이다.
//
// 고르는 자리는 05 P25 가 정한 두 곳뿐이다: 로그인 화면과 설정 > 언어.
// 관리자 화면에는 두지 않는다.

import { useState } from 'react';

import { LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/lang';
import { setLang } from '@/lib/i18n/store';
import { useLang, useT } from '@/lib/i18n/use-t';

/**
 * 국기 한 장.
 *
 * ko · en · zh 는 public/icons 의 png 를 **전과 같은 방식으로** 쓴다.
 * 일본 국기만 인라인 SVG 다 — 파일이 없어 전에는 `https://flagcdn.com/w40/jp.png`
 * 를 가리키고 있었는데, 기숙사 망에서 외부 CDN 이 막히면(08 · 11번이 폰트를 두고
 * 걱정하는 바로 그 상황) 일본어를 찾는 사람 눈앞에서 깨진 이미지가 된다.
 * 07 「디자인」 도 일본 국기는 SVG 로 그리기로 정해 두었다.
 */
function LangFlag({ lang, width, height }: { lang: Lang; width: number; height: number }) {
  const shared = { width: `${width}px`, height: `${height}px`, borderRadius: '3px', boxShadow: '0 0 0 1px rgba(47,99,184,.14)' };

  if (lang === 'ja') {
    return (
      <svg viewBox="0 0 30 20" style={shared} aria-label={LANG_LABELS.ja} role="img">
        <rect width="30" height="20" fill="#fff" />
        <circle cx="15" cy="10" r="6" fill="#BC002D" />
      </svg>
    );
  }

  const src = { ko: '/icons/flag-kr.png', en: '/icons/flag-en.png', zh: '/icons/flag-zh.png' }[lang];
  // eslint-disable-next-line @next/next/no-img-element -- 옮겨 오기 전 두 화면이 쓰던 방식 그대로다
  return <img src={src} alt={LANG_LABELS[lang]} style={shared} />;
}

/**
 * 아래에서 올라오는 언어 목록.
 *
 * 마크업은 옮겨 오기 전 두 화면의 모달과 같다 — 배경 `rgba(23,23,23,.45)`,
 * 시트 `20px 20px 0 0`, 선택된 줄 `#F2F7FD` + `#2F63B8` 체크까지.
 * 바뀐 것은 `setCurrentLang(key)` 가 `setLang(lang)` 이 된 것뿐이다.
 */
function LanguageSheet({ onClose }: { onClose: () => void }) {
  const current = useLang();
  const t = useT();

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(23,23,23,.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', width: '100%', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid rgba(112,115,124,.12)' }}>
          <span style={{ fontSize: '16px', fontWeight: 800 }}>{t('lang.modalTitle')}</span>
          <div onClick={onClose} style={{ cursor: 'pointer', color: 'rgba(55,56,60,.5)', fontSize: '20px', lineHeight: 1, padding: '2px 6px' }}>×</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px 24px', gap: '8px' }}>
          {LANGS.map((lang) => (
            <div
              key={lang}
              onClick={() => {
                setLang(lang);
                onClose();
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', background: current === lang ? '#F2F7FD' : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LangFlag lang={lang} width={24} height={16} />
                {/* 언어 이름은 번역하지 않는다 — 그 언어로 적혀 있어야 찾을 수 있다 */}
                <span style={{ fontSize: '15px', fontWeight: current === lang ? 700 : 500, color: current === lang ? '#2F63B8' : '#1E3557' }}>
                  {LANG_LABELS[lang]}
                </span>
              </div>
              {current === lang && (
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.2l2.3 2.3 4.7-4.7" stroke="#2F63B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 로그인 화면 오른쪽 위의 알약 버튼 + 모달. 위치 · 스타일은 전과 같다 */
export function LoginLanguagePicker() {
  const [open, setOpen] = useState(false);
  const current = useLang();

  return (
    <>
      <div onClick={() => setOpen(true)} style={{ position: 'absolute', top: '58px', right: '20px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid #E3EBF7', padding: '6px 10px', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(47,99,184,.08)' }}>
        <LangFlag lang={current} width={20} height={14} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#33456B' }}>{LANG_LABELS[current]}</span>
        <svg width="10" height="6" viewBox="0 0 12 8" fill="none" style={{ marginLeft: '2px' }}>
          <path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#5B93E0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
      </div>

      {open && <LanguageSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * 설정 화면 「언어」 그룹의 한 줄 + 모달.
 *
 * `cell` · `ctitle` 클래스는 설정 화면이 자기 <style> 에 들고 있는 것이다 —
 * 이 컴포넌트가 그 안에서 렌더되므로 전과 똑같이 걸린다.
 */
export function SettingsLanguagePicker() {
  const [open, setOpen] = useState(false);
  const current = useLang();
  const t = useT();

  return (
    <>
      <div className="cell" onClick={() => setOpen(true)} style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
        <span className="ctitle">{t('lang.rowLabel')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5B93E0', fontWeight: 600 }}>
          <LangFlag lang={current} width={20} height={14} />
          {LANG_LABELS[current]}
        </div>
      </div>

      {open && <LanguageSheet onClose={() => setOpen(false)} />}
    </>
  );
}
