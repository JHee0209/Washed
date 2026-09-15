// 화면 값 — **docs/design/*.dc.html 의 인라인 스타일을 그대로 옮긴 것**이다.
//
// 추상화하지 않는다. 프로토타입이 `padding:14px` 면 여기도 14, `border-radius:20px`
// 면 20 이다. 값을 고칠 일이 생기면 .dc.html 쪽을 먼저 고치고 여기로 옮긴다.
//
// 출처를 주석에 적어 둔다 — 나중에 원본과 대조할 때 찾기 쉽게.

import type { CSSProperties } from 'react';

/** 카드 — 홈.dc.html
 *  background:#fff; border-radius:20px; padding:14px;
 *  box-shadow:0px 10px 26px -8px rgba(47,99,184,.28) */
export const card: CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  padding: 14,
  boxShadow: '0px 10px 26px -8px rgba(47,99,184,.28)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
};

/** 카드 제목 — 홈.dc.html  font-size:13px; font-weight:700; color:#5B93E0 */
export const cardTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#5B93E0',
};

/** 화면 제목 — 홈.dc.html
 *  font-size:23px; font-weight:800; letter-spacing:-0.02em; color:#1E3557 */
export const pageTitle: CSSProperties = {
  margin: 0,
  fontSize: 23,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  color: '#1E3557',
};

/** 화면 부제 — 홈.dc.html  font-size:13px; color:#8FAAD0 */
export const pageSub: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#8FAAD0',
};

/** 섹션 제목 — 홈.dc.html
 *  font-size:17px; font-weight:800; letter-spacing:-0.02em; color:#1E3557 */
export const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  color: '#1E3557',
};

/** 기기 이름 — 홈.dc.html
 *  font-size:12.5px; font-weight:700; 말줄임 */
export const machineName: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** 알약 배지 — 기록.dc.html
 *  display:inline-flex; gap:5px; padding:5px 9px; border-radius:999px */
export function pill(bg: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 9px',
    borderRadius: 999,
    background: bg,
    flexShrink: 0,
  };
}

/** 목록 한 줄 — 기록.dc.html
 *  display:flex; align-items:center; gap:12px; padding:14px 16px;
 *  border-bottom:1px solid #EDF2F9 */
export const listRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderBottom: '1px solid #EDF2F9',
};

/** 경고 상자 — 기록.dc.html
 *  border-radius:16px; padding:15px 16px; background:#FEF6EC;
 *  border:1px solid #F7E0C4 */
export const warnBox: CSSProperties = {
  borderRadius: 16,
  padding: '15px 16px',
  background: '#FEF6EC',
  border: '1px solid #F7E0C4',
  display: 'flex',
  flexDirection: 'column',
  gap: 11,
};

/** 경고 상자 안의 작은 칸 — 기록.dc.html
 *  padding:10px 12px; border-radius:12px; background:#fff; border:1px solid #F3E2CC */
export const warnItem: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 12px',
  borderRadius: 12,
  background: '#fff',
  border: '1px solid #F3E2CC',
};

/** 입력칸 — 회원가입.dc.html
 *  border:none; outline:none; border-radius:14px;
 *  box-shadow:inset 0 0 0 1px <선>; padding:12px 14px; font-size:14px; color:#1E3557
 *
 *  로그인.dc.html 의 .field(높이 52px · border 1.5px)와 다르다 — 회원가입 계열은
 *  box-shadow 로 테두리를 그린다. 원본이 그렇게 돼 있어 그대로 둔다. */
export function boxField(line = '#E3EBF7', fontSize = 14): CSSProperties {
  return {
    width: '100%',
    border: 'none',
    outline: 'none',
    borderRadius: 14,
    boxShadow: `inset 0 0 0 1px ${line}`,
    padding: '12px 14px',
    fontSize,
    color: '#1E3557',
    background: '#fff',
    fontFamily: 'inherit',
  };
}

/** 입력칸 라벨 — 회원가입.dc.html  font-size:12.5px; font-weight:700; color:#5A7CA8 */
export const boxLabel: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: '#5A7CA8',
};

/** 주 버튼 — 회원가입.dc.html
 *  background:#4C86D8; border-radius:14px; padding:16px; font-size:16px;
 *  font-weight:700; box-shadow:0px 8px 18px -6px rgba(47,99,184,.75) */
export const submitBtn: CSSProperties = {
  width: '100%',
  border: 'none',
  cursor: 'pointer',
  color: '#fff',
  background: '#4C86D8',
  borderRadius: 14,
  padding: 16,
  fontSize: 16,
  fontWeight: 700,
  boxShadow: '0px 8px 18px -6px rgba(47,99,184,.75)',
};

/** 상태 색 — Design System.dc.html 의 status.* 토큰 (2026-09-15 갱신) */
export const status = {
  positive: { dot: '#00BF40', fg: '#006E25', bg: 'rgba(0,191,64,.1)' },
  cautionary: { dot: '#FF9200', fg: '#9C5800', bg: 'rgba(255,146,0,.12)' },
  negative: { dot: '#E52222', fg: '#C2453E', bg: 'rgba(229,34,34,.1)' },
  primary: { dot: '#2F63B8', fg: '#2F63B8', bg: 'rgba(47,99,184,.1)' },
  neutral: { dot: '#B5B5B5', fg: '#70737C', bg: '#F3F6FB' },
} as const;

export type StatusKey = keyof typeof status;
