'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type SplashClientProps = {
  target: '/home' | '/login';
};

const BUBBLES = [
  { left: 44, size: 21, duration: 17, delay: 0, sway: 7 },
  { left: 108, size: 12, duration: 13, delay: 3.4, sway: 5.5 },
  { left: 176, size: 28, duration: 20, delay: 6.2, sway: 8.5 },
  { left: 250, size: 15, duration: 15, delay: 1.8, sway: 6.5 },
  { left: 318, size: 10, duration: 12, delay: 8, sway: 5 },
  { left: 352, size: 19, duration: 18, delay: 4.6, sway: 7.5 },
] as const;

/**
 * 루트(/) 진입 시 보여 주는 Washed 스플래시.
 *
 * docs/design/스플래시 (온보딩).dc.html 을 실제 앱 자산으로 옮긴다.
 * 인증 판정은 서버(page.tsx)가 먼저 끝내고, 이 컴포넌트는 잠깐 스플래시를
 * 보여 준 뒤 이미 정해진 목적지로 replace 한다. 그래서 로그인 여부를
 * 클라이언트에서 다시 추측하지 않는다.
 */
export default function SplashClient({ target }: SplashClientProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(target);
    const timer = window.setTimeout(() => {
      router.replace(target);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [router, target]);

  return (
    <>
      <style>{`
        @keyframes washed-mark-settle {
          0% { opacity: 0; transform: scale(.86); }
          60% { opacity: 1; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes washed-glow-in {
          0% { opacity: 0; transform: scale(.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes washed-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes washed-ring-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes washed-rise-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes washed-tag-in {
          0% { opacity: 0; letter-spacing: 5.5px; }
          100% { opacity: 1; letter-spacing: 2.4px; }
        }
        @keyframes washed-bubble-rise {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-940px); opacity: 0; }
        }
        @keyframes washed-bubble-sway {
          0% { transform: translateX(0); }
          50% { transform: translateX(14px); }
          100% { transform: translateX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .washed-splash * {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <main
        className="washed-splash"
        aria-label="Washed 시작 화면"
        style={{
          minHeight: '100dvh',
          width: '100%',
          background: '#EAEBEC',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          className="splash-frame"
          style={{
            // 크기는 `.splash-frame` 이 맡는다 (src/app/splash.css · Issue #69).
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg,#FFFFFF 0%,#F4F8FE 46%,#E4EDFA 100%)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -170,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 620,
              height: 620,
              borderRadius: '50%',
              background:
                'radial-gradient(circle,rgba(91,147,224,.16) 0%,rgba(91,147,224,0) 62%)',
              pointerEvents: 'none',
            }}
          />

          <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
          >
            {BUBBLES.map((bubble) => (
              <div
                key={bubble.left}
                style={{
                  position: 'absolute',
                  left: bubble.left,
                  bottom: -40,
                  animation: `washed-bubble-rise ${bubble.duration}s linear infinite ${bubble.delay}s`,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: bubble.size,
                    height: bubble.size,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(91,147,224,.30)',
                    background: 'rgba(91,147,224,.06)',
                    animation: `washed-bubble-sway ${bubble.sway}s ease-in-out infinite`,
                  }}
                >
                  {bubble.size >= 19 ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 4,
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'rgba(91,147,224,.30)',
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: 196,
              height: 196,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                animation: 'washed-ring-in .5s ease-out .5s both',
              }}
            >
              <svg
                width="196"
                height="196"
                viewBox="0 0 196 196"
                style={{ display: 'block', animation: 'washed-spin 2.4s linear infinite' }}
              >
                <circle
                  cx="98"
                  cy="98"
                  r="94"
                  fill="none"
                  stroke="rgba(91,147,224,.14)"
                  strokeWidth="2"
                />
                <circle
                  cx="98"
                  cy="98"
                  r="94"
                  fill="none"
                  stroke="#5B93E0"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="92 498"
                  opacity=".85"
                />
              </svg>
            </div>

            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                width: 150,
                height: 150,
                borderRadius: 40,
                background: 'rgba(91,147,224,.20)',
                filter: 'blur(26px)',
                animation: 'washed-glow-in 1s ease-out both',
              }}
            />

            <div
              style={{
                position: 'relative',
                width: 132,
                height: 132,
                borderRadius: 36,
                background: '#fff',
                boxShadow:
                  '0 14px 32px rgba(47,99,184,.14), 0 2px 6px rgba(47,99,184,.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'washed-mark-settle .8s cubic-bezier(.22,1,.36,1) both',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/logo-mark.png"
                alt="Washed"
                style={{ width: 86, height: 86, objectFit: 'contain' }}
              />
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              marginTop: 34,
              fontSize: 37,
              fontWeight: 800,
              color: '#2F63B8',
              letterSpacing: '-1.4px',
              lineHeight: 1,
              animation: 'washed-rise-in .7s cubic-bezier(.22,1,.36,1) .45s both',
            }}
          >
            Washed
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              marginTop: 14,
              fontSize: 11,
              fontWeight: 700,
              color: '#93AFD6',
              letterSpacing: '2.4px',
              textTransform: 'uppercase',
              animation: 'washed-tag-in .8s ease-out .8s both',
            }}
          >
            Cleaner · Easier · Together
          </div>

          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              zIndex: 1,
              bottom: 'max(36px, env(safe-area-inset-bottom))',
              fontSize: 12,
              fontWeight: 500,
              color: '#A8BCD9',
              animation: 'washed-rise-in .7s ease-out 1.15s both',
            }}
          >
            세탁실 상태를 불러오는 중
          </div>
        </div>
      </main>
    </>
  );
}
