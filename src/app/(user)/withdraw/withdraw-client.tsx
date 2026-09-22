'use client';

// 탈퇴 복구 안내의 **그리는 쪽** (F36 · 05 P24).
//
// page.tsx 에서 갈라져 나왔다. 화면 문구를 번역하려면 useT() 가 필요하고 그것은
// 클라이언트에서만 돈다 — /home · /settings 가 이미 쓰고 있는 page.tsx +
// *-client.tsx 짝과 같은 꼴이다.
//
// **판정은 여기로 오지 않았다.** 남은 날짜(`daysLeft`)는 KST 자정 경계를 세는
// 정책 판정이라 서버 시각으로 해야 하므로(CLAUDE.md) page.tsx 에 그대로 두고,
// 여기는 계산이 끝난 `daysLeft` 숫자와 ISO 문자열만 받아 서식만 입힌다.

import Link from 'next/link';

import { formatDate, formatDateTime } from '@/lib/i18n/datetime';
import { Rich } from '@/lib/i18n/rich';
import { useLang, useT } from '@/lib/i18n/use-t';

import RestoreButton from './restore-button';

// 크기 · 여백 · 모서리는 `.app-frame` 이 맡는다 ((user)/user-layout.css · Issue #69).
// `position: relative` 는 여기 남아야 한다 — 화면 안의 overlay 가 이 상자를 기준으로 잡힌다.
const frame: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  background: '#F3F6FB',
  color: '#1E3557',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '63px 20px 12px',
  background: '#fff',
  borderBottom: '1px solid #EAF0FA',
  width: '100%',
  height: '96px',
  position: 'relative',
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  border: '1px solid #E6EDF7',
  padding: '18px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
};

const rowLabel: React.CSSProperties = { fontSize: '13px', color: '#8FAAD0', flexShrink: 0 };
const rowValue: React.CSSProperties = { fontSize: '14px', fontWeight: 600, textAlign: 'right' };

const pageStyle = `
  body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
  html { overflow: hidden; }
  * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
  a { color: #2F63B8; text-decoration: none; }
  a:hover { color: #1F4E9C; }
  .no-scrollbar { scrollbar-width: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
`;

/** 이미 복구된 계정 — page.tsx 의 설명대로 redirect 하지 않고 안내만 띄운다 */
export function WithdrawRestored() {
  const t = useT();

  return (
    <>
      <style>{pageStyle}</style>
      <div className="app-frame" style={frame}>
        <div style={header}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>
            {t('withdraw.restoredHeader')}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ ...card, alignItems: 'center', textAlign: 'center', gap: '14px' }}>
            <span style={{ fontSize: '17px', fontWeight: 800 }}>{t('withdraw.restoredTitle')}</span>
            <span style={{ fontSize: '13px', color: '#8FAAD0', lineHeight: 1.6 }}>
              {t('withdraw.restoredBody')}
            </span>
            <Link
              href="/home"
              style={{
                width: '100%',
                textAlign: 'center',
                color: '#fff',
                background: '#4C86D8',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '14.5px',
                fontWeight: 700,
              }}
            >
              {t('withdraw.goHome')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function WithdrawPending({
  requestedAtIso,
  deleteAtIso,
  daysLeft,
}: {
  requestedAtIso: string;
  deleteAtIso: string;
  /** 서버가 KST 자정 기준으로 이미 센 값 — 여기서 다시 계산하지 않는다 */
  daysLeft: number;
}) {
  const t = useT();
  const lang = useLang();

  return (
    <>
      <style>{pageStyle}</style>

      <div className="app-frame" style={frame}>
        {/* 홈 · 기록 · 설정의 로고 헤더가 아니라 /support 꼴의 제목 헤더를 쓴다 —
            이 화면에는 하단 탭도, 돌아갈 곳도 없다(탈퇴 대기 중에는 여기뿐이다). */}
        <div style={header}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>
            {t('withdraw.header')}
          </span>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '24px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '5px' }}>
              <h1 style={{ margin: 0, fontSize: '25px', fontWeight: 800, letterSpacing: '-0.8px' }}>
                {t('withdraw.pendingTitle')}
              </h1>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#8FAAD0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {/* 남은 날짜만 굵게 — 원문의 <b>{left}일</b> 자리다 */}
                <Rich
                  messageKey="withdraw.pendingBody"
                  slots={{
                    days: <b style={{ color: '#2F63B8' }}>{t('withdraw.daysLeft', { count: daysLeft })}</b>,
                  }}
                />
              </p>
            </div>

            <div style={card}>
              <div style={rowStyle}>
                <span style={rowLabel}>{t('withdraw.requestedAt')}</span>
                <span style={rowValue}>{formatDateTime(lang, requestedAtIso)}</span>
              </div>
              <div style={{ height: '1px', background: '#EDF2F9' }} />
              <div style={rowStyle}>
                <span style={rowLabel}>{t('withdraw.deleteAt')}</span>
                <span style={{ ...rowValue, color: '#E0554E' }}>{formatDate(lang, deleteAtIso)}</span>
              </div>
            </div>

            <div
              style={{
                background: '#FEF6EC',
                border: '1px solid #F7E0C4',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#B4690E' }}>
                {t('withdraw.warnTitle')}
              </span>
              <span style={{ fontSize: '12.5px', color: '#8A6A3D', lineHeight: 1.6 }}>
                {t('withdraw.warnBody')}
              </span>
            </div>

            <div style={{ ...card, gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700 }}>{t('withdraw.keepTitle')}</span>
                <span style={{ fontSize: '12.5px', color: '#8FAAD0', lineHeight: 1.6 }}>
                  {t('withdraw.keepBody')}
                </span>
              </div>
              <RestoreButton />
            </div>

            <span style={{ textAlign: 'center', fontSize: '11.5px', color: '#A8BCD9' }}>{t('common.appVersion')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
