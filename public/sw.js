// 서비스 워커 — PWA 설치와 폰 알림(F8)의 받는 쪽.
//
// 지금은 **설치 요건을 채우고 푸시를 받을 준비만** 한다. 캐시 전략은 두지 않는다 —
// 줄서기 현황은 항상 최신이어야 해서(05 P2) 캐시가 오히려 해롭다.
//
// 푸시를 실제로 보내려면 서버 쪽(web-push · VAPID 키)이 더 필요하다.
// push_subscriptions 표는 이미 있다 (06 「푸시 구독」 · 08 · 12번).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// 폰 알림 받기 (F8)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Washed', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Washed', {
      body: payload.body || '',
      icon: '/icons/logo-mark.png',
      badge: '/icons/logo-mark.png',
      data: { url: payload.url || '/home' },
    }),
  );
});

// 알림을 누르면 앱을 연다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
