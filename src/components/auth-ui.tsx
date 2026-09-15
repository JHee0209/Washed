// 로그인 · 회원가입 · 비밀번호찾기가 함께 쓰는 조각들.
// 값(색 · 크기)은 docs/design/*.dc.html 그대로다.

'use client';

import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';

/** 세 화면 공통 배경 — 로그인.dc.html 의 그라데이션 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 40px',
        background: 'linear-gradient(180deg,#FFFFFF 0%,#F4F8FE 46%,#E4EDFA 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -190,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(91,147,224,.16) 0%,rgba(91,147,224,0) 62%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 342 }}>
        {children}
      </div>
    </div>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 26,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: '#fff',
          boxShadow: '0 10px 24px rgba(47,99,184,.14),0 2px 6px rgba(47,99,184,.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image src="/icons/logo-mark.png" alt="Washed" width={42} height={42} priority />
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 26,
          fontWeight: 800,
          color: '#2F63B8',
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        Washed
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#8FAAD0',
            letterSpacing: -0.2,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 24,
        padding: '24px 22px 22px',
        boxShadow: '0 14px 36px rgba(47,99,184,.12),0 2px 8px rgba(47,99,184,.05)',
      }}
    >
      {children}
    </div>
  );
}

export const fieldLabel: CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 700,
  color: '#5A7CA8',
  marginBottom: 7,
};

/** 오류 · 안내 문구 상자. tone 으로 색만 가른다. */
export function Notice({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'ok' | 'info';
  children: ReactNode;
}) {
  const palette = {
    error: { bg: 'rgba(224,85,78,.08)', fg: '#C2453E' },
    ok: { bg: 'rgba(0,191,64,.1)', fg: '#006E25' },
    info: { bg: '#F3F6FB', fg: '#5A6E8F' },
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      style={{
        marginTop: 12,
        padding: '11px 13px',
        borderRadius: 12,
        background: palette.bg,
        fontSize: 12.5,
        fontWeight: 500,
        lineHeight: 1.6,
        color: palette.fg,
      }}
    >
      {children}
    </div>
  );
}

/** 남은 시간 mm:ss (인증코드 유효시간 표시) */
export function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
