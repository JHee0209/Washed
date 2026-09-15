// 서비스 워커를 등록한다. 이게 있어야 「홈 화면에 추가」가 앱처럼 동작하고
// 폰 알림(F8)을 받을 수 있다.

'use client';

import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 등록에 실패해도 앱은 그대로 돈다 — 알림만 못 받는다
    });
  }, []);
  return null;
}
