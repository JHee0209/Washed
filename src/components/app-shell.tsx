// 로그인 뒤 화면들이 공유하는 껍데기 — 상단바 · 본문 · 하단 탭바.
//
// 값은 docs/design/홈.dc.html 의 구조를 그대로 옮긴 것이다.
//   상단바  흰 배경 · 아래 1px #EAF0FA · 로고 34px · 종 아이콘 오른쪽
//   본문    #F3F6FB · padding 20px 16px 24px · 세로 gap 20px
//   탭바    높이 60px · 흰색 92% + blur · 점 7px + 글자 10.5px
//
// 프로토타입은 390×844 아이폰 프레임 안에 그려져 있다. 실제 앱은 폰 화면을 꽉 채우므로
// 프레임을 두지 않고 최대 폭만 잡는다 — 데스크톱에서 열어도 폰 비율로 보인다.

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Tab = 'home' | 'history' | 'settings';

const TABS: { key: Tab; href: string; label: string }[] = [
  { key: 'home', href: '/home', label: '홈' },
  { key: 'history', href: '/history', label: '기록' },
  { key: 'settings', href: '/settings', label: '설정' },
];

export function AppShell({
  active,
  unread = 0,
  children,
}: {
  active: Tab;
  unread?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        maxWidth: 430,
        margin: '0 auto',
        background: '#F3F6FB',
        color: '#1E3557',
      }}
    >
      {/* 상단바 */}
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 20px 12px',
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          background: '#fff',
          borderBottom: '1px solid #EAF0FA',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <Image src="/icons/logo-mark.png" alt="" width={34} height={34} priority />
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#2F63B8',
            letterSpacing: -0.3,
            marginLeft: -3,
          }}
        >
          Washed
        </span>

        <Link
          href="/notifications"
          aria-label="알림"
          style={{ marginLeft: 'auto', position: 'relative', display: 'flex' }}
        >
          <BellIcon active={unread > 0} />
          {unread > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: '#E52222',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
      </header>

      {/* 본문 */}
      <main
        style={{
          flex: '1 1 0',
          minHeight: 0,
          padding: '20px 16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {children}
      </main>

      {/* 하단 탭바 */}
      <nav
        style={{
          flexShrink: 0,
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(112,115,124,.12)',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', gap: 28 }}>
          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <Link
                key={t.key}
                href={t.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '5px 16px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  background: on ? 'rgba(0,102,255,.08)' : 'transparent',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: on ? '#0066FF' : '#B5B5B5',
                  }}
                />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: on ? '#0066FF' : '#70737C',
                  }}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a6 6 0 0 0-6 6v3.6l-1.3 2.6A.8.8 0 0 0 5.4 16h13.2a.8.8 0 0 0 .7-1.2L18 12.6V9a6 6 0 0 0-6-6Z"
        stroke={active ? '#2F63B8' : '#8FAAD0'}
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={active ? 'rgba(47,99,184,.10)' : 'none'}
      />
      <path
        d="M9.8 19a2.3 2.3 0 0 0 4.4 0"
        stroke={active ? '#2F63B8' : '#8FAAD0'}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 화면 안의 흰 카드 — 프로토타입의 공통 카드 값 */
export function Panel({
  children,
  padding = 14,
}: {
  children: ReactNode;
  padding?: number | string;
}) {
  return (
    <section
      style={{
        // 홈.dc.html — border-radius:20px; padding:14px;
        // box-shadow:0px 10px 26px -8px rgba(47,99,184,.28)
        background: '#fff',
        borderRadius: 20,
        padding,
        boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
      }}
    >
      {children}
    </section>
  );
}

/** 카드 제목 */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        // 홈.dc.html — font-size:13px; font-weight:700; color:#5B93E0
        margin: 0,
        fontSize: 13,
        fontWeight: 700,
        color: '#5B93E0',
      }}
    >
      {children}
    </h2>
  );
}

/** 상태 배지 — 07 「상태 색」 · Design System 의 status.* 토큰 */
export function Badge({
  tone,
  children,
}: {
  tone: 'blue' | 'green' | 'orange' | 'red' | 'grey';
  children: ReactNode;
}) {
  const p = {
    blue: { bg: 'rgba(47,99,184,.1)', fg: '#2F63B8', dot: '#2F63B8' },
    green: { bg: 'rgba(0,191,64,.1)', fg: '#006E25', dot: '#00BF40' },
    orange: { bg: 'rgba(255,146,0,.12)', fg: '#9C5800', dot: '#FF9200' },
    red: { bg: 'rgba(229,34,34,.1)', fg: '#C2453E', dot: '#E52222' },
    grey: { bg: '#F3F6FB', fg: '#8FAAD0', dot: '#B5B5B5' },
  }[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        // 기록.dc.html — padding:5px 9px; border-radius:999px; gap:5px
        padding: '5px 9px',
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: p.dot,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}

/** 내용이 없을 때 */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '32px 16px',
        textAlign: 'center',
        fontSize: 13,
        color: '#8FAAD0',
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}
