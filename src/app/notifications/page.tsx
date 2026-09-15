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

type NotificationKind = '공지' | '배정' | '종료' | '경고' | '결과';

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
// 값은 결과로 두고 사용자에게 보이는 이름만 "신고 결과" 로 적는다.
const TYPES: Record<NotificationKind, { pillBg: string; pillFg: string; dot: string; label: string }> = {
  공지: { pillBg: '#EEF2F8', pillFg: '#5A7CA8', dot: '#B4C2D6', label: '공지' },
  배정: { pillBg: 'rgba(47,99,184,.1)', pillFg: '#2F63B8', dot: '#2F63B8', label: '배정' },
  종료: { pillBg: 'rgba(0,191,64,.1)', pillFg: '#006E25', dot: '#00BF40', label: '종료' },
  경고: { pillBg: 'rgba(255,146,0,.12)', pillFg: '#9C5800', dot: '#FF9200', label: '경고' },
  결과: { pillBg: '#F1EAFB', pillFg: '#6B3FA0', dot: '#9B6FD1', label: '신고 결과' },
};

const TABS: { value: string; label: string }[] = [
  { value: '전체', label: '전체' },
  { value: '공지', label: '공지' },
  { value: '배정', label: '배정' },
  { value: '종료', label: '종료' },
  { value: '경고', label: '경고' },
  { value: '결과', label: '신고 결과' },
];

/** 다른 화면의 종 표시에게 "알림이 바뀌었다" 고 알린다 (useUnreadCount 가 받는다) */
const CHANGED_EVENT = 'washed:notifications-changed';

export default function NotificationsPage() {
  const [filter, setFilter] = useState('전체');
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.status === 401) {
        setLoadError('로그인이 필요해요.');
        setItems([]);
        return;
      }
      const data = (await res.json()) as { ok: boolean; items?: NotificationRow[]; message?: string };
      if (!data.ok || !data.items) {
        setLoadError(data.message ?? '알림을 불러오지 못했어요.');
        return;
      }
      setItems(data.items);
      setLoadError('');
    } catch {
      setLoadError('알림을 불러오지 못했어요.');
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
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
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
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
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
    if (offset === 0) return '오늘';
    if (offset === 1) return '어제';
    const d = new Date(midnightTs);
    d.setDate(d.getDate() - offset);
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`;
  };

  const timeLabel = (received: string) =>
    new Date(received).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  const visible = items.filter((n) => filter === '전체' || n.kind === filter);

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
        const t = TYPES[n.kind] ?? TYPES['공지'];
        return {
          id: n.notification_id,
          title: n.title,
          body: n.body,
          time: timeLabel(n.received_at),
          typeLabel: t.label,
          pillBg: t.pillBg,
          pillFg: t.pillFg,
          dotColor: n.is_read ? 'transparent' : t.dot,
          rowBg: n.is_read ? '#fff' : '#FBFDFF',
          titleColor: n.is_read ? '#5A6E8F' : '#1E3557',
          titleWeight: n.is_read ? '600' : '700',
          onClick: () => markRead(n.notification_id),
        };
      }),
  }));

  const isEmpty = groups.length === 0;
  const filterLabel = TABS.find((t) => t.value === filter)?.label ?? filter;
  const emptyTitle = loadError
    ? loadError
    : loading
      ? '알림을 불러오는 중이에요'
      : filter === '전체'
        ? '받은 알림이 없어요'
        : filter === '배정'
          ? '배정된 알림이 없어요'
          : filter === '결과'
            ? '신고에 대한 결과가 없어요'
            : `${filterLabel} 알림이 없어요`;

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
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>알림</span>
        </div>

        {/* 탭 & 카운트 영역 */}
        <div style={{ flexShrink: 0, padding: '18px 16px 12px', background: '#F3F6FB' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#8FAAD0' }}>읽지 않은 알림 {unreadCount}개</span>
            <button onClick={markAllRead} style={{ border: 'none', cursor: unreadCount > 0 ? 'pointer' : 'default', background: unreadCount > 0 ? '#fff' : 'transparent', color: unreadCount > 0 ? '#2F63B8' : '#C3D2E6', boxShadow: unreadCount > 0 ? 'inset 0 0 0 1px #E6EDF7' : 'none', borderRadius: '999px', padding: '7px 13px', fontSize: '12px', fontWeight: 700 }}>
              모두 읽음
            </button>
          </div>

          <div className="no-scrollbar" style={{ marginTop: '14px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '6px', width: 'max-content', paddingBottom: '2px' }}>
              {TABS.map((tab) => {
                const on = filter === tab.value;
                const count = tab.value === '전체'
                  ? items.filter((n) => !n.is_read).length
                  : items.filter((n) => n.kind === tab.value && !n.is_read).length;
                
                const tabLabel = count > 0 ? `${tab.label} ${count}` : tab.label;
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
                  {loadError ? '잠시 뒤 다시 시도해주세요' : '새 알림이 오면 여기에 쌓여요'}
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