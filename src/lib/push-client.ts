// 브라우저에서 푸시 구독을 만들고 서버에 저장한다 (F40 · 06 「푸시 구독」).
// 홈 첫 진입 배너와 설정의 "알림이 꺼져 있어요" 줄이 같은 코드를 쓴다.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

export function iosNeedsInstallSnapshot(): boolean {
  return isIos() && !isStandalone();
}

export function iosNeedsInstallServerSnapshot(): boolean {
  return false;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

// ---------------------------------------------------------------------------
// 허용 상태 읽기 — useSyncExternalStore 용
//
// 허용 여부는 React 밖(브라우저)에 있다. 효과 안에서 setState 로 옮겨 담으면
// 렌더가 한 번 더 돌고(react-hooks/set-state-in-effect) 서버 렌더와도 어긋나므로,
// **바깥 상태를 그대로 구독**한다. 브라우저가 허용 상태 변경을 알려주지 않기 때문에
// 우리가 바꾼 순간(enablePush · markAsked)에만 직접 알린다.
// ---------------------------------------------------------------------------

export type PushPermission = NotificationPermission | 'unsupported';

/** 홈 첫 진입 배너를 이미 띄웠는지 (기기 단위 · 05 P26 · washed_lang 과 같은 방식) */
const ASKED_KEY = 'washed_push_asked';

let listeners: (() => void)[] = [];

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePushState(callback: () => void): () => void {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

export function permissionSnapshot(): PushPermission {
  return pushSupported() ? Notification.permission : 'unsupported';
}

/** 서버 렌더에는 브라우저가 없다 — 아직 아무것도 묻지 않은 상태로 그린다. */
export function permissionServerSnapshot(): PushPermission {
  return 'default';
}

export function askedSnapshot(): boolean {
  try {
    return !!window.localStorage.getItem(ASKED_KEY);
  } catch {
    return true; // 저장소를 못 쓰면 묻지 않는다(매번 묻는 것보다 낫다)
  }
}

/** 서버에서는 "이미 물어본 것" 으로 둔다 — 깜빡했다가 사라지는 배너를 막는다. */
export function askedServerSnapshot(): boolean {
  return true;
}

export function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // 저장소를 못 써도 이번 화면에서는 배너가 닫힌다
  }
  emit();
}

/**
 * 허용을 묻고, 허용했으면 구독을 만들어 서버에 저장한다.
 * 브라우저가 이미 거절을 기억하고 있으면 창이 뜨지 않고 바로 'denied' 가 돌아온다 —
 * 그때는 폰의 사이트 설정에서 직접 켜야 한다.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied';

  const permission = await Notification.requestPermission();
  emit();
  if (permission !== 'granted') return permission;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY 가 없습니다.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  return permission;
}

/**
 * 이미 권한이 있는 경우(granted), 기기 구독이 서버에 확실히 저장되어 있도록 동기화한다.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    if (subscription) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
    }
  } catch (error) {
    console.error('푸시 구독 동기화 실패', error);
  }
}
