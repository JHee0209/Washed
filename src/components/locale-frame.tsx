'use client';

// 일반 사용자 화면에만 씌우는 언어 껍데기 (F37 · Issue #13 의 4번 · 8번).
//
// ── 왜 root layout 이 아니라 여기인가
// src/app/layout.tsx 는 `/admin` 까지 감싼다. 거기에 언어를 붙이면 관리자 화면이
// 사용자의 washed_lang 을 따라가 버린다. 이 컴포넌트는 `(user)` 라우트 그룹의
// layout 에서만 mount 되므로, 관리자 화면은 **구조적으로** 이 아래로 들어올 수 없다.
//
// ── 하는 일 두 가지
//   1. <html lang> 을 지금 언어로 맞춘다. 스크린리더의 발음과 브라우저 번역 제안이
//      이 값을 본다. root layout 의 `lang="ko"` 를 서버에서 바꿀 수 없으므로
//      (그 파일은 관리자와 공용이다) 여기서 명령형으로 고친다.
//   2. `data-lang` 을 내려 globals.css 의 중국어 · 일본어 글꼴 규칙이 걸리게 한다.
//
// ── unmount 에서 되돌리는 이유
// `/settings` 에서 `/admin` 으로 클라이언트 이동하면 이 컴포넌트는 사라지지만
// <html lang="ja"> 는 남는다. 관리자 화면은 한국어 고정이므로 되돌려 놓는다.

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { DEFAULT_LANG } from '@/lib/i18n/lang';
import { useLang } from '@/lib/i18n/use-t';

export default function LocaleFrame({ children }: { children: ReactNode }) {
  const lang = useLang();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    return () => {
      root.lang = DEFAULT_LANG;
    };
  }, [lang]);

  // `display: contents` — 이 div 는 박스를 만들지 않는다.
  // 사용자 화면은 전부 390×844 고정 프레임에 `margin: 40px auto` 로 놓여 있어서,
  // 여기에 실제 박스가 하나 끼면 가운데 정렬과 높이 계산이 어긋난다.
  return (
    <div data-lang={lang} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
