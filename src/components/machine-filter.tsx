// 기기 목록 — 홈.dc.html 의 「기기 목록」 절.
//   필터 알약  background:#E4EDFA; border-radius:12px; padding:3px
//             항목 padding:5px 8px; border-radius:10px; font-size:10.5px
//   기기 타일  border-radius:14px; padding:10px; 3열 격자 gap:8px
//             아이콘 24px · 이름 11px/700 · 배지 점 5px + 글자 9.5px
//             진행 막대 height:4px; #EDF2FA / #5B93E0

'use client';

import Image from 'next/image';
import { useState } from 'react';

type M = {
  machineId: string;
  name: string;
  kind: string;
  status: string;
  minutesLeft: number | null;
};

const FILTERS = ['전체', '세탁기', '건조기'] as const;

function badge(s: string) {
  if (s === '사용가능') return { dot: '#00BF40', fg: '#006E25', label: '사용가능' };
  if (s === '사용중') return { dot: '#5B93E0', fg: '#2F63B8', label: '사용중' };
  if (s === '고장') return { dot: '#E52222', fg: '#C2453E', label: '고장' };
  return { dot: '#FF9200', fg: '#9C5800', label: s };
}

export default function MachineFilter({ machines }: { machines: M[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체');

  const washers = machines.filter((m) => m.kind === '세탁기');
  const dryers = machines.filter((m) => m.kind === '건조기');
  const showW = filter !== '건조기' && washers.length > 0;
  const showD = filter !== '세탁기' && dryers.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>기기 목록</div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: '#E4EDFA',
            borderRadius: 12,
            padding: 3,
          }}
        >
          {FILTERS.map((f) => {
            const on = f === filter;
            return (
              <div
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  cursor: 'pointer',
                  padding: '5px 8px',
                  borderRadius: 10,
                  fontSize: 10.5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  background: on ? '#fff' : 'transparent',
                  color: on ? '#2F63B8' : '#8FAAD0',
                }}
              >
                {f}
              </div>
            );
          })}
        </div>
      </div>

      {machines.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)',
            textAlign: 'center',
            fontSize: 12,
            color: '#8FAAD0',
            lineHeight: 1.6,
          }}
        >
          등록된 기기가 없어요.
          <br />
          관리자가 기기를 추가하면 여기에 보입니다.
        </div>
      ) : null}

      {showW ? <Group label="세탁기" list={washers} /> : null}
      {showW && showD ? <div style={{ height: 1, background: '#E3EBF7' }} /> : null}
      {showD ? <Group label="건조기" list={dryers} /> : null}
    </div>
  );
}

function Group({ label, list }: { label: string; list: M[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8FAAD0' }}>{label}</span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          gap: 8,
        }}
      >
        {list.map((m) => {
          const b = badge(m.status);
          const broken = m.status === '고장';
          const src = `/icons/${m.kind === '건조기' ? 'dryer' : 'washer'}-${
            m.status === '사용가능' ? 'available' : 'inuse'
          }.svg`;

          return (
            <div
              key={m.machineId}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: 10,
                boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minWidth: 0,
              }}
            >
              {broken ? (
                <div style={{ position: 'relative', width: 24, height: 24, flexShrink: 0 }}>
                  <Image
                    src={src}
                    alt=""
                    width={24}
                    height={24}
                    style={{ filter: 'grayscale(1) opacity(.55)' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#E52222',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    !
                  </div>
                </div>
              ) : (
                <Image src={src} alt="" width={24} height={24} style={{ flexShrink: 0 }} />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.name}
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: b.dot,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: b.fg }}>{b.label}</span>
                </div>
              </div>

              {m.minutesLeft !== null && m.status === '사용중' ? (
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: '#EDF2FA',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${Math.max(0, Math.min(100, 100 - (m.minutesLeft / 60) * 100))}%`,
                      background: '#5B93E0',
                      borderRadius: 2,
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
