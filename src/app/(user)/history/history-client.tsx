'use client';

// 기록 화면의 **그리는 쪽** (F13 · 05 P7 · P14 · P21).
//
// page.tsx 에서 갈라져 나왔다 — 화면 문구를 네 언어로 그리려면 useT() 가 필요하고
// 그것은 클라이언트에서만 돈다(/home · /settings 와 같은 짝).
//
// **날짜 판정은 여기로 오지 않았다.** 「오늘 · 어제」는 KST 자정 경계를 넘나드는
// 판정이라 서버 시각으로 해야 한다(CLAUDE.md). 서버가 `{ kind: 'today' | 'yesterday' |
// 'date' }` 로 판정해 내려보내고, 여기서는 그 결과에 문구만 입힌다.
//
// 상태값 · 사유는 **DB 한국어 값 그대로** 받아 표시할 때만 db-labels 로 번역한다.

import Link from 'next/link';

import NotificationBell from '@/components/notification-bell';
import { formatMonthDay, formatTime } from '@/lib/i18n/datetime';
import { HISTORY_RESULT_KEY, warningReasonKey, type HistoryResult } from '@/lib/i18n/db-labels';
import { useLang, useT } from '@/lib/i18n/use-t';

/** 서버가 판정해 내려보내는 날짜 묶음 제목 */
export type DateLabel =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'date'; iso: string };

export type HistoryItem = {
  key: string;
  at: string;
  /** DB 값 그대로. 기기가 지워졌으면 null 이다 */
  machineName: string | null;
  /** '세탁기' | '건조기' — 아이콘을 고르는 데 쓴다. 경고만 있는 줄은 null */
  machineKind: string | null;
  durationMinutes?: number;
  /** usage_history.result 의 DB 값 */
  result: HistoryResult;
  /**
   * 경고만 있고 이용 세션이 없는 줄(`배정 후 미인증`)의 사유. warnings.reason 의 DB 값이다.
   * **이 값이 있으면 그것이 곧 줄의 제목이다** — 제목과 본문에 같은 사유를 두 번
   * 적지 않는다(옮겨 오기 전에는 같은 문장이 두 줄로 겹쳐 보였다).
   */
  warningReason?: string;
};

export type HistoryGroup = { key: string; label: DateLabel; items: HistoryItem[] };

export type HistoryWarning = { warningId: string; issuedAt: string; reason: string; label: DateLabel };

const STATUS_STYLE: Record<HistoryResult, { bg: string; dot: string; fg: string }> = {
  완료: { bg: 'rgba(0,191,64,.1)', dot: '#00BF40', fg: '#006E25' },
  경고: { bg: 'rgba(255,146,0,.12)', dot: '#FF9200', fg: '#9C5800' },
};

export default function HistoryClient({
  groups,
  warnings,
  useCount,
  totalMinutes,
  warningCount,
  restrictedDaysLeft,
}: {
  groups: HistoryGroup[];
  warnings: HistoryWarning[];
  useCount: number;
  totalMinutes: number;
  warningCount: number;
  /** 제한 중이 아니면 null — 판정은 서버가 한다 */
  restrictedDaysLeft: number | null;
}) {
  const t = useT();
  const lang = useLang();

  const dateText = (label: DateLabel) =>
    label.kind === 'today'
      ? t('common.today')
      : label.kind === 'yesterday'
        ? t('common.yesterday')
        : formatMonthDay(lang, label.iso);

  /** DB 사유를 화면 문구로 — 모르는 옛 값이면 저장된 원문을 그대로 보여준다 */
  const reasonText = (reason: string) => {
    const key = warningReasonKey(reason);
    return key ? t(key) : reason;
  };

  const useHours =
    totalMinutes >= 60
      ? t('history.hours', { count: Math.floor(totalMinutes / 60) })
      : t('history.minutes', { count: totalMinutes });

  const hasWarnings = warningCount > 0;
  const suspendLabel =
    restrictedDaysLeft !== null
      ? t('history.restricted', { days: restrictedDaysLeft })
      : t('history.warningHint');

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
        .card { background: #fff; border-radius: 16px; border: 1px solid #E6EDF7; }
        .chip { width: 38px; height: 38px; border-radius: 12px; background: #F2F7FD; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>

        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 옮겨 오기 전 page.tsx 가 쓰던 방식 그대로다 */}
          <img src="/icons/logo-mark.png" alt="Washed" style={{ width: '34px', height: '34px', objectFit: 'contain', marginLeft: '-3px', marginTop: '2px' }} />
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2F63B8', letterSpacing: '-0.3px', marginLeft: '-7px', marginTop: '2px' }}>Washed</span>
          <NotificationBell />
        </div>

        {/* 메인 스크롤 영역 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '18px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px', animation: 'riseIn .5s ease-out both' }}>

            {/* 타이틀 */}
            <div>
              <h1 style={{ margin: 0, fontSize: '25px', fontWeight: 800, letterSpacing: '-0.7px' }}>{t('history.title')}</h1>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#8FAAD0' }}>{t('history.subtitle')}</p>
            </div>

            {/* 상단 통계 카드 */}
            <div className="card" style={{ display: 'flex', padding: '16px 0' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#2F63B8', lineHeight: 1 }}>{useCount}</div>
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#8FAAD0' }}>{t('history.statUseCount')}</div>
              </div>
              <div style={{ width: '1px', background: '#EDF2F9' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#2F63B8', lineHeight: 1 }}>{useHours}</div>
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#8FAAD0' }}>{t('history.statTotalTime')}</div>
              </div>
              <div style={{ width: '1px', background: '#EDF2F9' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#D98324', lineHeight: 1 }}>{warningCount}</div>
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#8FAAD0' }}>{t('history.statWarnings')}</div>
              </div>
            </div>

            {/* 경고 박스 */}
            {hasWarnings && (
              <div style={{ borderRadius: '16px', padding: '15px 16px', background: '#FEF6EC', border: '1px solid #F7E0C4', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F0913F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>!</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#8A5220' }}>{t('history.warningCount', { count: warningCount })}</div>
                    <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#A97740', lineHeight: 1.5 }}>{suspendLabel}</div>
                  </div>
                </div>
                {warnings.map((w) => (
                  <div key={w.warningId} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 12px', borderRadius: '12px', background: '#fff', border: '1px solid #F3E2CC' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8A5220' }}>{dateText(w.label)} {formatTime(lang, w.issuedAt)}</span>
                    <span style={{ fontSize: '11.5px', color: '#A97740' }}>{reasonText(w.reason)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 타임라인 히스토리 내역 */}
            {groups.map((grp) => (
              <div key={grp.key} style={{ position: 'relative', paddingLeft: '20px' }}>
                {/* 좌측 세로 선과 파란 점 */}
                <div style={{ position: 'absolute', left: '3px', top: '7px', bottom: '6px', width: '2px', background: '#E3EBF7', borderRadius: '1px' }}></div>
                <div style={{ position: 'absolute', left: 0, top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#5B93E0', boxShadow: '0 0 0 3px #E8F1FD' }}></div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#5A7CA8', marginBottom: '9px' }}>{dateText(grp.label)}</div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  {grp.items.map((h, hIdx) => {
                    const status = STATUS_STYLE[h.result];
                    // 경고만 있는 줄은 사유가 곧 제목이다 — 같은 문장을 아래에 또 적지 않는다.
                    // 그 밖의 줄은 기기 이름(DB 원문 · 사용자가 넣은 값이 아니어도 번역하지 않는다).
                    const isWarningOnly = h.warningReason !== undefined;
                    const title = isWarningOnly
                      ? reasonText(h.warningReason as string)
                      : (h.machineName ?? t('history.deletedMachine'));
                    const iconSrc = isWarningOnly
                      ? null
                      : h.machineKind === '건조기'
                        ? '/icons/dryer-history.svg'
                        : '/icons/washer-history.svg';

                    return (
                      <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: hIdx === grp.items.length - 1 ? 'none' : '1px solid #EDF2F9' }}>
                        <div className="chip">
                          {iconSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element -- 옮겨 오기 전 방식 그대로
                            <img src={iconSrc} alt={title} style={{ width: '24px', height: '24px' }} />
                          ) : (
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F0913F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>!</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{title}</span>
                          <span style={{ fontSize: '11.5px', color: '#8FAAD0', marginTop: '3px' }}>
                            {formatTime(lang, h.at)}
                            {h.durationMinutes !== undefined &&
                              ` · ${t('history.durationUsed', { duration: t('history.minutes', { count: h.durationMinutes }) })}`}
                          </span>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 9px', borderRadius: '999px', background: status.bg, flexShrink: 0 }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: status.dot }}></div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: status.fg }}>{t(HISTORY_RESULT_KEY[h.result])}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* 하단 탭 바 */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '8px 0', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(112,115,124,.12)', height: '60px' }}>
          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center' }}>
            <Link href="/home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>{t('nav.home')}</span>
            </Link>
            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px', background: 'rgba(0,102,255,.08)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0066FF' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#0066FF' }}>{t('nav.history')}</span>
            </Link>
            <Link href="/settings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '5px 16px', borderRadius: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#B5B5B5' }}></div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#70737C' }}>{t('nav.settings')}</span>
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
