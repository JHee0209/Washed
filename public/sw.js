// 서비스 워커 — PWA 설치와 폰 알림(F8 · F40)의 받는 쪽.
//
// 캐시 전략은 두지 않는다 — 줄서기 현황은 항상 최신이어야 해서(05 P2) 캐시가
// 오히려 해롭다. 설치 요건을 채우고 푸시를 받는 일만 한다.
//
// 알림 문구는 서버가 완성해서 보낸다(08 · 11번) — 여기서는 받은 그대로 띄우고,
// 누르면 그 화면으로 보내기만 한다.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// 폰 알림 받기 (F8 · 05 P26)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    // 본문이 없거나 JSON 이 아닐 수도 있다 — 그래도 알림은 띄운다.
    // 여기서 return 해 버리면 사용자는 아무것도 못 받는다.
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Washed', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Washed';
  const url = payload.url || '/home';

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || '',
        icon: '/icons/logo-mark.png',
        badge: '/icons/logo-mark.png',
        data: { url },
      }),
      // 앱을 열어 둔 채 알림을 받으면 종의 안 읽음 표시도 같이 움직여야 한다.
      // 열려 있는 화면에 알려 주고, 받는 쪽(useUnreadCount)이 다시 세어 본다.
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((list) => {
          for (const client of list) {
            client.postMessage({ type: 'washed:notification' });
          }
        }),
    ]),
  );
});

// 알림을 누르면 그 화면을 연다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // 1) 이미 그 화면을 열어 둔 창이 있으면 그리로 간다
      for (const client of list) {
        if (new URL(client.url).pathname === url && 'focus' in client) {
          return client.focus();
        }
      }
      // 2) 다른 화면이 열려 있으면 그 창을 살리고 해당 화면으로 옮긴다.
      //    (창이 있는데 새 창을 또 여는 것을 막는다)
      for (const client of list) {
        if ('focus' in client) {
          return client.focus().then((focused) =>
            focused && 'navigate' in focused ? focused.navigate(url) : focused,
          );
        }
      }
      // 3) 열린 창이 없으면 새로 연다
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
    }),
  );
});
