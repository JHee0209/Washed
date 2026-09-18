'use client';

// 안 읽은 알림 수 (F18) — 상단 바 종에 붙는 점.
//
// 홈 · 기록 · 설정 세 화면이 같은 값을 그린다. 세 곳이 각자 세면 서로 어긋나므로
// 훅 하나로 모으고, 개수는 서버가 센다(GET /api/notifications/unread →
// lib/notifications.ts). 보관 기간 필터(30일 · 「공지」만 3개월 · 05 P14 · P18)가
// 목록과 같은 규칙으로 걸리려면 계산이 한 곳에 있어야 한다.
//
// **언제 다시 세는가**가 이 파일의 전부다. 한 번만 읽으면 알림함에서 "모두 읽음" 을
// 누르고 홈으로 돌아왔을 때 종이 옛 값을 그대로 들고 있다. 그래서 값이 바뀔 수 있는
// 순간마다 다시 센다 — 폴링은 하지 않는다(Neon 요청만 늘고 정확해지지도 않는다).
//
//   1. 처음 그릴 때
//   2. 창이 다시 focus 될 때
//   3. 탭이 다시 보이게 될 때 (모바일에서 앱을 다시 열면 focus 없이 이것만 온다)
//   4. 알림함이 읽음 처리를 마치고 알릴 때 (washed:notifications-changed)
//   5. 앱이 열린 채 푸시가 도착했다고 서비스 워커가 알릴 때 (public/sw.js)

import { useCallback, useEffect, useState } from 'react';

/** 알림함이 읽음 처리 뒤에 쏘는 이벤트. 이름을 두 곳에서 같게 쓴다. */
export const NOTIFICATIONS_CHANGED_EVENT = 'washed:notifications-changed';

/**
 * 세어 오기만 한다 — 화면 상태는 건드리지 않는다.
 * 셀 수 없었으면 null 을 돌려주고, 부르는 쪽이 마지막 값을 그대로 두게 한다.
 */
async function fetchUnread(): Promise<number | null> {
  try {
    const res = await fetch('/api/notifications/unread', { cache: 'no-store' });
    // 401(로그인 전)이면 종에 점을 띄울 이유가 없다.
    if (res.status === 401) return 0;
    if (!res.ok) return null;

    const data = (await res.json()) as { ok: boolean; count?: number };
    return data.ok && typeof data.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}

export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  // 값을 넣는 자리는 **콜백 안**이다. 못 세었으면(null) 그대로 둔다 —
  // 0 으로 떨어뜨리면 있던 점이 사라져 사용자가 알림을 놓친다.
  const refresh = useCallback(() => {
    fetchUnread().then((next) => {
      if (next !== null) setCount(next);
    });
  }, []);

  useEffect(() => {
    refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'washed:notification') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);

    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    sw?.addEventListener('message', onSwMessage);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      sw?.removeEventListener('message', onSwMessage);
    };
  }, [refresh]);

  return count;
}
