'use client';

// F17 · F18 알림함 — docs/design/알림.dc.html
//
// 목록은 DB 가 원본이다(06 「알림」). 이 화면은 'use client' 라 server-only 인
// lib/notifications.ts 를 직접 부를 수 없어 GET /api/notifications 로 읽는다.
//
// 보관 기간(30일 · 「공지」만 3개월 · 05 P14 · P18)은 **서버가** 건다 —
// 08 · 148줄: "조회 기간은 각 조회 API 에 두고 화면에서는 자르지 않는다".

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NOTIFICATION_KIND_KEY, type NotificationKind } from '@/lib/i18n/db-labels';
import { INTL_LOCALE } from '@/lib/i18n/lang';
import { useLang, useT } from '@/lib/i18n/use-t';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/lib/use-unread-count';

type NotificationRow = {
  notification_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  is_read: boolean;
  received_at: string;
};

// 종류별 색 — 알림.dc.html 그대로다.
// 프로토타입의 「신고」는 06 「알림」의 종류 값으로는 **결과**다
// (kind CHECK 이 공지 · 배정 · 종료 · 경고 · 결과라 '신고' 는 DB 가 받지 않는다).
// 값은 결과로 두고 사용자에게 보이는 이름만 "신고" 로 적는다.
// 라벨은 여기가 아니라 db-labels.ts 의 NOTIFICATION_KIND_KEY 가 들고 있다 —
// **이 화면이 원래 쓰던 「값 / 라벨 가르기」를 네 언어로 넓힌 것이 Issue #13 이다.**
const TYPES: Record<NotificationKind, { pillBg: string; pillFg: string; dot: string }> = {
  공지: { pillBg: '#EEF2F8', pillFg: '#5A7CA8', dot: '#B4C2D6' },
  배정: { pillBg: 'rgba(47,99,184,.1)', pillFg: '#2F63B8', dot: '#2F63B8' },
  종료: { pillBg: 'rgba(0,191,64,.1)', pillFg: '#006E25', dot: '#00BF40' },
  경고: { pillBg: 'rgba(255,146,0,.12)', pillFg: '#9C5800', dot: '#FF9200' },
  결과: { pillBg: '#F1EAFB', pillFg: '#6B3FA0', dot: '#9B6FD1' },
};

/** 전체 탭의 값. DB 종류가 아니라 「거르지 않음」을 뜻하는 표시값이다 */
const ALL = '전체';

/** 사전 문장(key)이거나, 서버가 보낸 문장(text)이거나 */
type LoadError =
  | { kind: 'key'; key: 'common.loginRequired' | 'notifications.loadFailed' }
  | { kind: 'text'; text: string }
  | null;

/** value 는 **DB 값 그대로** 둔다 — 이 값으로 n.kind 를 거른다 */
type TabLabelKey =
  | 'notifications.tabAll'
  | (typeof NOTIFICATION_KIND_KEY)[NotificationKind];

const TABS: { value: string; labelKey: TabLabelKey }[] = [
  { value: ALL, labelKey: 'notifications.tabAll' },
  { value: '공지', labelKey: NOTIFICATION_KIND_KEY['공지'] },
  { value: '배정', labelKey: NOTIFICATION_KIND_KEY['배정'] },
  { value: '종료', labelKey: NOTIFICATION_KIND_KEY['종료'] },
  { value: '경고', labelKey: NOTIFICATION_KIND_KEY['경고'] },
  { value: '결과', labelKey: NOTIFICATION_KIND_KEY['결과'] },
];

export default function NotificationsClient() {
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState(ALL);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * 오류는 **문장이 아니라 key** 로 담는다 — 오류가 떠 있는 채로 언어를 바꿔도
   * 그 자리에서 함께 바뀐다. 서버가 보낸 문장(`message`)은 아직 한국어라
   * 그대로 담아 두고, code 기반 번역은 뒤 단계에서 붙인다.
   */
  const [loadError, setLoadError] = useState<LoadError>(null);

  // load 가 t 를 붙잡지 않게 한다 — 붙잡으면 언어를 바꿀 때마다 목록을 다시 읽는다.
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.status === 401) {
        setLoadError({ kind: 'key', key: 'common.loginRequired' });
        setItems([]);
        return;
      }
      const data = (await res.json()) as { ok: boolean; items?: NotificationRow[]; message?: string };
      if (!data.ok || !data.items) {
        setLoadError(
          data.message
            ? { kind: 'text', text: data.message }
            : { kind: 'key', key: 'notifications.loadFailed' },
        );
        return;
      }
      setItems(data.items);
      setLoadError(null);
    } catch {
      setLoadError({ kind: 'key', key: 'notifications.loadFailed' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 목록을 다시 읽어야 하는 순간들. useUnreadCount 와 같은 원칙이다 — 폴링하지 않고
  // 값이 바뀌었을 수 있는 때에만 읽는다.
  //
  //   · 창이 다시 focus 될 때
  //   · 탭이 다시 보이게 될 때 (모바일에서 앱을 다시 열면 focus 없이 이것만 온다)
  //   · 앱이 열린 채 푸시가 도착했다고 서비스 워커가 알릴 때
  //
  // 앞의 둘이 없으면 **푸시를 허용하지 않은 사람**의 화면이 영영 갱신되지 않는다.
  // 그쪽에는 서비스 워커 알림이 오지 않지만 DB 에는 알림이 쌓이기 때문이다(05 P26).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'washed:notification') load();
    };

    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);

    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    sw?.addEventListener('message', onSwMessage);

    return () => {
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
      sw?.removeEventListener('message', onSwMessage);
    };
  }, [load]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  /**
   * 읽음 처리. **서버가 성공한 뒤에** 화면을 바꾼다 — 미리 읽음으로 칠해 두면
   * 실패했을 때 사용자는 읽은 줄 알지만 DB 는 그대로라 종이 다시 켜진다.
   */
  const markRead = async (notificationId: string) => {
    const target = items.find((n) => n.notification_id === notificationId);
    if (!target || target.is_read) return;
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) return;

      setItems((prev) =>
        prev.map((n) => (n.notification_id === notificationId ? { ...n, is_read: true } : n)),
      );
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      // 실패하면 아무것도 바꾸지 않는다 — 다음에 다시 누르면 된다.
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) return;

      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      // 그대로 둔다.
    }
  };

  // --- 날짜 묶기 (받은 시각 기준) ---
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = midnight.getTime();

  const dayOffset = (received: string) => {
    const d = new Date(received);
    d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((midnightTs - d.getTime()) / 86400000));
  };

  const dateLabel = (offset: number) => {
    if (offset === 0) return t('common.today');
    if (offset === 1) return t('common.yesterday');
    const d = new Date(midnightTs);
    d.setDate(d.getDate() - offset);
    // 묶기가 **브라우저 자정** 기준이라(dayOffset) 라벨도 같은 기준으로 그린다 —
    // 여기서 시간대를 KST 로 못 박으면 묶음과 제목이 어긋난다.
    return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(d);
  };

  const timeLabel = (received: string) =>
    new Date(received).toLocaleTimeString(INTL_LOCALE[lang], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  const visible = items.filter((n) => filter === ALL || n.kind === filter);

  const offsets: number[] = [];
  visible.forEach((n) => {
    const o = dayOffset(n.received_at);
    if (!offsets.includes(o)) offsets.push(o);
  });
  offsets.sort((a, b) => a - b);

  const groups = offsets.map((offset) => ({
    date: dateLabel(offset),
    items: visible
      .filter((n) => dayOffset(n.received_at) === offset)
      .map((n) => {
        // 번역 함수 t 와 이름이 겹치지 않게 style 로 받는다
        const style = TYPES[n.kind] ?? TYPES['공지'];
        return {
          id: n.notification_id,
          title: n.title,
          body: n.body,
          time: timeLabel(n.received_at),
          typeLabel: t(NOTIFICATION_KIND_KEY[n.kind] ?? NOTIFICATION_KIND_KEY['공지']),
          pillBg: style.pillBg,
          pillFg: style.pillFg,
          dotColor: n.is_read ? 'transparent' : style.dot,
          rowBg: n.is_read ? '#fff' : '#FBFDFF',
          titleColor: n.is_read ? '#5A6E8F' : '#1E3557',
          titleWeight: n.is_read ? '600' : '700',
          onClick: () => markRead(n.notification_id),
        };
      }),
  }));

  const isEmpty = groups.length === 0;
  const activeTab = TABS.find((tab) => tab.value === filter);
  const filterLabel = activeTab ? t(activeTab.labelKey) : filter;
  const loadErrorText = loadError
    ? loadError.kind === 'key'
      ? t(loadError.key)
      : loadError.text
    : '';
  const emptyTitle = loadErrorText
    ? loadErrorText
    : loading
      ? t('notifications.loading')
      : filter === ALL
        ? t('notifications.emptyAll')
        : filter === '배정'
          ? t('notifications.emptyAssigned')
          : filter === '결과'
            ? t('notifications.emptyReport')
            : t('notifications.emptyFiltered', { label: filterLabel });

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
        .card { background: #fff; border-radius: 16px; border: 1px solid #E6EDF7; overflow: hidden; }
        .pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700; flex-shrink: 0; }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px' }}>
          <Link href="/home" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>{t('notifications.title')}</span>
        </div>

        {/* 탭 & 카운트 영역 */}
        <div style={{ flexShrink: 0, padding: '18px 16px 12px', background: '#F3F6FB' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#8FAAD0' }}>{t('notifications.unreadCount', { count: unreadCount })}</span>
            <button onClick={markAllRead} style={{ border: 'none', cursor: unreadCount > 0 ? 'pointer' : 'default', background: unreadCount > 0 ? '#fff' : 'transparent', color: unreadCount > 0 ? '#2F63B8' : '#C3D2E6', boxShadow: unreadCount > 0 ? 'inset 0 0 0 1px #E6EDF7' : 'none', borderRadius: '999px', padding: '7px 13px', fontSize: '12px', fontWeight: 700 }}>
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="no-scrollbar" style={{ marginTop: '14px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '6px', width: 'max-content', paddingBottom: '2px' }}>
              {TABS.map((tab) => {
                const on = filter === tab.value;
                const count = tab.value === ALL
                  ? items.filter((n) => !n.is_read).length
                  : items.filter((n) => n.kind === tab.value && !n.is_read).length;
                
                const label = t(tab.labelKey);
                const tabLabel = count > 0 ? `${label} ${count}` : label;
                return (
                  <div key={tab.value} onClick={() => setFilter(tab.value)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: on ? '#4C86D8' : '#fff', color: on ? '#fff' : '#5A7CA8', boxShadow: on ? 'none' : 'inset 0 0 0 1px #E6EDF7' }}>
                    {tabLabel}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 메인 알림 스크롤 리스트 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '6px 16px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {isEmpty ? (
              <div style={{ padding: '70px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E8EFF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 13 6 9Z" stroke="#A8BCD9" strokeWidth="1.8" strokeLinejoin="round"></path><path d="M10 18a2 2 0 0 0 4 0" stroke="#A8BCD9" strokeWidth="1.8" strokeLinecap="round"></path></svg>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#5A7CA8' }}>{emptyTitle}</div>
                <div style={{ fontSize: '12.5px', color: '#A8BCD9' }}>
                  {loadError ? t('notifications.errorHint') : t('notifications.emptyHint')}
                </div>
              </div>
            ) : (
              groups.map((grp, gIdx) => (
                <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#5A7CA8', marginLeft: '2px' }}>{grp.date}</div>
                  <div className="card">
                    {grp.items.map((n, iIdx) => (
                      <div key={n.id} onClick={n.onClick} style={{ display: 'flex', gap: '11px', padding: '14px 15px', borderBottom: iIdx === grp.items.length - 1 ? 'none' : '1px solid #EDF2F9', cursor: 'pointer', background: n.rowBg }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.dotColor, marginTop: '7px', flexShrink: 0 }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span className="pill" style={{ background: n.pillBg, color: n.pillFg }}>{n.typeLabel}</span>
                            <span style={{ fontSize: '11px', color: '#A8BCD9', marginLeft: 'auto', flexShrink: 0 }}>{n.time}</span>
                          </div>
                          <span style={{ fontSize: '13.5px', fontWeight: n.titleWeight as any, color: n.titleColor, lineHeight: 1.4 }}>{n.title}</span>
                          <span style={{ fontSize: '12px', color: '#8FAAD0', lineHeight: 1.5 }}>{n.body}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

      </div>
    </>
  );
}