// 일반 사용자 화면 전용 layout (F37 · Issue #13 의 4번 · 11번).
//
// `(user)` 는 Next.js 의 **라우트 그룹**이라 괄호 이름이 URL 에 들어가지 않는다 —
// `/login` · `/home` · `/settings` 는 그대로다. 폴더를 옮긴 이유는 URL 이 아니라
// **관리자 격리**다. 언어 껍데기와 중국어 · 일본어 글꼴을 여기에만 두면,
// `/admin` 은 이 layout 을 거치지 않으므로 washed_lang 이 무엇이든 한국어로 남는다.
//
// src/app/layout.tsx(관리자와 공용)는 건드리지 않는다.

import { Noto_Sans_JP, Noto_Sans_SC } from 'next/font/google';

import LocaleFrame from '@/components/locale-frame';

// 사용자 화면 프레임의 반응형 규칙 (Issue #69).
// 여기서만 import 하므로 `/admin` 번들에는 들어가지 않는다 — 파일 머리말 참고.
import './user-layout.css';

// 중국어 · 일본어 글꼴 (07 「디자인」 의 「글꼴」 · 08 · 11번 마지막 줄).
//
// 기숙사 망에서 외부 폰트 CDN 이 막히면 글자가 깨지므로 **자체 호스팅**이 요구사항이다.
// next/font/google 은 빌드 시점에 폰트를 받아 우리 origin 에서 서빙한다 —
// 런타임에 fonts.gstatic.com 으로 나가는 요청이 없다.
//
//   · `subsets: []`  CJK 는 subset 이름으로 자를 수 없다. Next 가 구글의
//                    unicode-range 조각(100개 이상)을 그대로 self-host 하므로,
//                    브라우저는 화면에 실제로 나온 글자의 조각만 받는다.
//   · `preload: false` 조각이 너무 많아 preload 를 걸 수 없다(Next 권고).
//   · 가변 폰트라 화면이 쓰는 400 · 500 · 700 · 800 · 900 이 한 파일로 덮인다.
//   · `display: 'swap'` 폰트를 못 받아도 글자는 Pretendard 로 먼저 보인다 —
//                    로딩 실패로 화면이 비지 않게 하는 조건이다.
const notoSansSC = Noto_Sans_SC({
  subsets: [],
  variable: '--font-noto-sc',
  display: 'swap',
  preload: false,
});

const notoSansJP = Noto_Sans_JP({
  subsets: [],
  variable: '--font-noto-jp',
  display: 'swap',
  preload: false,
});

export default function UserLayout({ children }: { children: React.ReactNode }) {
  // 이 div 도 박스를 만들지 않는다(LocaleFrame 과 같은 이유) — CSS 변수만 내려보낸다.
  return (
    <div className={`${notoSansSC.variable} ${notoSansJP.variable}`} style={{ display: 'contents' }}>
      <LocaleFrame>{children}</LocaleFrame>
    </div>
  );
}
